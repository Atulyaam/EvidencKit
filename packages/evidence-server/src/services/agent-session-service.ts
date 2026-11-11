import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  SessionContext,
  requireOwnerAuthorization,
  requireWorkspaceAuthorization
} from "../authorization/index";
import {
  agentSessions,
  workspaces,
  DbClient,
  isDbConnectionError,
  assertInMemoryFallbackAllowed
} from "@evidencekit/db";
import { eq, and, desc, sql, like } from "drizzle-orm";
import { defaultChainService } from "./chain-service";
import { EvidenceEvent } from "@evidencekit/core";

export const AgentSessionStatusSchema = z.enum([
  "created",
  "running",
  "paused",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled"
]);
export type AgentSessionStatus = z.infer<typeof AgentSessionStatusSchema>;

export const CreateAgentSessionInputSchema = z.object({
  workspaceId: z.string().min(1).default("ws_demo_default"),
  agentName: z.string().trim().min(2).max(128),
  goal: z.string().trim().min(3).max(4096),
  metadata: z.record(z.unknown()).optional()
});
export type CreateAgentSessionInput = z.infer<typeof CreateAgentSessionInputSchema>;

export const UpdateAgentSessionInputSchema = z.object({
  status: AgentSessionStatusSchema.optional(),
  goal: z.string().trim().min(3).max(4096).optional(),
  metadata: z.record(z.unknown()).optional()
});
export type UpdateAgentSessionInput = z.infer<typeof UpdateAgentSessionInputSchema>;

export const AgentSessionQuerySchema = z.object({
  search: z.string().optional(),
  status: AgentSessionStatusSchema.optional(),
  agentName: z.string().optional(),
  workspaceId: z.string().optional(),
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
export type AgentSessionQuery = z.infer<typeof AgentSessionQuerySchema>;

export interface AgentSessionRecord {
  id: string;
  workspaceId: string;
  agentName: string;
  goal: string;
  status: AgentSessionStatus;
  metadata?: Record<string, unknown> | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSessionListResult {
  sessions: AgentSessionRecord[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export class AgentSessionService {
  private inMemorySessions: Map<string, AgentSessionRecord> = new Map();

  /**
   * Validates state transitions for agent sessions.
   */
  public isValidTransition(current: AgentSessionStatus, next: AgentSessionStatus): boolean {
    if (current === next) return true;

    // Terminal states cannot transition to anything
    if (current === "completed" || current === "failed" || current === "cancelled") {
      return false;
    }

    switch (current) {
      case "created":
        return next === "running" || next === "awaiting_approval" || next === "cancelled";
      case "running":
        return (
          next === "paused" ||
          next === "awaiting_approval" ||
          next === "completed" ||
          next === "failed" ||
          next === "cancelled"
        );
      case "paused":
        return next === "running" || next === "cancelled";
      case "awaiting_approval":
        return (
          next === "running" || next === "completed" || next === "failed" || next === "cancelled"
        );
      default:
        return false;
    }
  }

  public async createSession(
    input: unknown,
    context: SessionContext,
    db?: DbClient
  ): Promise<AgentSessionRecord> {
    requireOwnerAuthorization(context);
    const parsed = CreateAgentSessionInputSchema.parse(input);
    requireWorkspaceAuthorization(context, parsed.workspaceId);
    const now = new Date().toISOString();

    const session: AgentSessionRecord = {
      id: `session_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      workspaceId: parsed.workspaceId,
      agentName: parsed.agentName,
      goal: parsed.goal,
      status: "created",
      metadata: parsed.metadata ?? {},
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };

    if (db) {
      try {
        await db
          .insert(workspaces)
          .values({
            id: session.workspaceId,
            name: `Workspace ${session.workspaceId}`
          })
          .onConflictDoNothing();

        await db.insert(agentSessions).values({
          id: session.id,
          workspaceId: session.workspaceId,
          agentName: session.agentName,
          goal: session.goal,
          status: session.status,
          metadata: session.metadata,
          startedAt: null,
          completedAt: null,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt)
        });
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentSessionOperation", err);
      }
    }

    this.inMemorySessions.set(session.id, session);

    // Record initial canonical event
    const initEvent: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: session.id,
      event_name: "agent.session.created",
      occurred_at: now,
      observed_at: now,
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "agent",
        id: session.agentName
      },
      severity: "info",
      attributes: {
        workspace_id: session.workspaceId,
        agent_name: session.agentName,
        goal: session.goal,
        status: session.status,
        metadata: session.metadata
      }
    };

    try {
      if (db) {
        await defaultChainService.appendTransactional(initEvent, db);
      } else {
        defaultChainService.appendInMemory(initEvent);
      }
    } catch {
      defaultChainService.appendInMemory(initEvent);
    }

    return session;
  }

  public async startSession(
    id: string,
    context: SessionContext,
    workspaceId: string = "ws_demo_default",
    db?: DbClient
  ): Promise<AgentSessionRecord> {
    requireOwnerAuthorization(context);
    requireWorkspaceAuthorization(context, workspaceId);
    const existing = await this.getSession(id, workspaceId, db, context);
    if (!existing) {
      throw new Error(`Session '${id}' not found in workspace '${workspaceId}'`);
    }

    if (!this.isValidTransition(existing.status, "running")) {
      throw new Error(
        `Invalid state transition: cannot start session in status '${existing.status}'`
      );
    }

    const now = new Date().toISOString();
    const updated: AgentSessionRecord = {
      ...existing,
      status: "running",
      startedAt: existing.startedAt || now,
      updatedAt: now
    };

    if (db) {
      try {
        await db
          .update(agentSessions)
          .set({
            status: updated.status,
            startedAt: new Date(updated.startedAt!),
            updatedAt: new Date(now)
          })
          .where(and(eq(agentSessions.id, id), eq(agentSessions.workspaceId, workspaceId)));
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentSessionOperation", err);
      }
    }

    this.inMemorySessions.set(id, updated);

    // Record run started event
    const startEvent: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: id,
      event_name: "agent.run.started",
      occurred_at: now,
      observed_at: now,
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "agent",
        id: existing.agentName
      },
      severity: "info",
      attributes: {
        started_at: now
      }
    };

    try {
      if (db) {
        await defaultChainService.appendTransactional(startEvent, db);
      } else {
        defaultChainService.appendInMemory(startEvent);
      }
    } catch {
      defaultChainService.appendInMemory(startEvent);
    }

    return updated;
  }

  public async pauseSession(
    id: string,
    context: SessionContext,
    workspaceId: string = "ws_demo_default",
    db?: DbClient
  ): Promise<AgentSessionRecord> {
    requireOwnerAuthorization(context);
    requireWorkspaceAuthorization(context, workspaceId);
    const existing = await this.getSession(id, workspaceId, db, context);
    if (!existing) {
      throw new Error(`Session '${id}' not found in workspace '${workspaceId}'`);
    }

    if (!this.isValidTransition(existing.status, "paused")) {
      throw new Error(
        `Invalid state transition: cannot pause session from status '${existing.status}'`
      );
    }

    const now = new Date().toISOString();
    const updated: AgentSessionRecord = {
      ...existing,
      status: "paused",
      updatedAt: now
    };

    if (db) {
      try {
        await db
          .update(agentSessions)
          .set({
            status: updated.status,
            updatedAt: new Date(now)
          })
          .where(and(eq(agentSessions.id, id), eq(agentSessions.workspaceId, workspaceId)));
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentSessionOperation", err);
      }
    }

    this.inMemorySessions.set(id, updated);
    return updated;
  }

  public async completeSession(
    id: string,
    summary: string,
    context: SessionContext,
    workspaceId: string = "ws_demo_default",
    db?: DbClient
  ): Promise<AgentSessionRecord> {
    requireOwnerAuthorization(context);
    requireWorkspaceAuthorization(context, workspaceId);
    const existing = await this.getSession(id, workspaceId, db, context);
    if (!existing) {
      throw new Error(`Session '${id}' not found in workspace '${workspaceId}'`);
    }

    if (!this.isValidTransition(existing.status, "completed")) {
      throw new Error(
        `Invalid state transition: cannot complete session from status '${existing.status}'`
      );
    }

    const now = new Date().toISOString();
    const updatedMetadata = { ...(existing.metadata || {}), summary };
    const updated: AgentSessionRecord = {
      ...existing,
      status: "completed",
      metadata: updatedMetadata,
      completedAt: now,
      updatedAt: now
    };

    if (db) {
      try {
        await db
          .update(agentSessions)
          .set({
            status: updated.status,
            metadata: updated.metadata,
            completedAt: new Date(now),
            updatedAt: new Date(now)
          })
          .where(and(eq(agentSessions.id, id), eq(agentSessions.workspaceId, workspaceId)));
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentSessionOperation", err);
      }
    }

    this.inMemorySessions.set(id, updated);

    // Record run completed event
    const completeEv: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: id,
      event_name: "agent.run.completed",
      occurred_at: now,
      observed_at: now,
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "agent",
        id: existing.agentName
      },
      severity: "info",
      attributes: {
        summary,
        completed_at: now
      }
    };

    try {
      if (db) {
        await defaultChainService.appendTransactional(completeEv, db);
      } else {
        defaultChainService.appendInMemory(completeEv);
      }
    } catch {
      defaultChainService.appendInMemory(completeEv);
    }

    return updated;
  }

  public async failSession(
    id: string,
    error: string,
    context: SessionContext,
    workspaceId: string = "ws_demo_default",
    db?: DbClient
  ): Promise<AgentSessionRecord> {
    requireOwnerAuthorization(context);
    requireWorkspaceAuthorization(context, workspaceId);
    const existing = await this.getSession(id, workspaceId, db, context);
    if (!existing) {
      throw new Error(`Session '${id}' not found in workspace '${workspaceId}'`);
    }

    if (!this.isValidTransition(existing.status, "failed")) {
      throw new Error(
        `Invalid state transition: cannot fail session from status '${existing.status}'`
      );
    }

    const now = new Date().toISOString();
    const updatedMetadata = { ...(existing.metadata || {}), error };
    const updated: AgentSessionRecord = {
      ...existing,
      status: "failed",
      metadata: updatedMetadata,
      completedAt: now,
      updatedAt: now
    };

    if (db) {
      try {
        await db
          .update(agentSessions)
          .set({
            status: updated.status,
            metadata: updated.metadata,
            completedAt: new Date(now),
            updatedAt: new Date(now)
          })
          .where(and(eq(agentSessions.id, id), eq(agentSessions.workspaceId, workspaceId)));
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentSessionOperation", err);
      }
    }

    this.inMemorySessions.set(id, updated);

    // Record run failed event
    const failEv: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: id,
      event_name: "agent.run.failed",
      occurred_at: now,
      observed_at: now,
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "agent",
        id: existing.agentName
      },
      severity: "critical",
      attributes: {
        error,
        failed_at: now
      }
    };

    try {
      if (db) {
        await defaultChainService.appendTransactional(failEv, db);
      } else {
        defaultChainService.appendInMemory(failEv);
      }
    } catch {
      defaultChainService.appendInMemory(failEv);
    }

    return updated;
  }

  public async cancelSession(
    id: string,
    reason: string,
    context: SessionContext,
    workspaceId: string = "ws_demo_default",
    db?: DbClient
  ): Promise<AgentSessionRecord> {
    requireOwnerAuthorization(context);
    requireWorkspaceAuthorization(context, workspaceId);
    const existing = await this.getSession(id, workspaceId, db, context);
    if (!existing) {
      throw new Error(`Session '${id}' not found in workspace '${workspaceId}'`);
    }

    if (!this.isValidTransition(existing.status, "cancelled")) {
      throw new Error(
        `Invalid state transition: cannot cancel session from status '${existing.status}'`
      );
    }

    const now = new Date().toISOString();
    const updatedMetadata = { ...(existing.metadata || {}), cancelReason: reason };
    const updated: AgentSessionRecord = {
      ...existing,
      status: "cancelled",
      metadata: updatedMetadata,
      completedAt: now,
      updatedAt: now
    };

    if (db) {
      try {
        await db
          .update(agentSessions)
          .set({
            status: updated.status,
            metadata: updated.metadata,
            completedAt: new Date(now),
            updatedAt: new Date(now)
          })
          .where(and(eq(agentSessions.id, id), eq(agentSessions.workspaceId, workspaceId)));
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentSessionOperation", err);
      }
    }

    this.inMemorySessions.set(id, updated);
    return updated;
  }

  public async updateSessionStatus(
    id: string,
    nextStatus: AgentSessionStatus,
    workspaceId: string = "ws_demo_default",
    db?: DbClient
  ): Promise<AgentSessionRecord> {
    const existing = await this.getSession(id, workspaceId, db);
    if (!existing) {
      throw new Error(`Session '${id}' not found in workspace '${workspaceId}'`);
    }

    if (!this.isValidTransition(existing.status, nextStatus)) {
      throw new Error(`Invalid transition from '${existing.status}' to '${nextStatus}'`);
    }

    const now = new Date().toISOString();
    const updated: AgentSessionRecord = {
      ...existing,
      status: nextStatus,
      updatedAt: now
    };

    if (db) {
      try {
        await db
          .update(agentSessions)
          .set({
            status: nextStatus,
            updatedAt: new Date(now)
          })
          .where(and(eq(agentSessions.id, id), eq(agentSessions.workspaceId, workspaceId)));
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentSessionOperation", err);
      }
    }

    this.inMemorySessions.set(id, updated);
    return updated;
  }

  public async getSession(
    id: string,
    workspaceId: string = "ws_demo_default",
    db?: DbClient,
    context?: SessionContext
  ): Promise<AgentSessionRecord | null> {
    if (context) {
      requireWorkspaceAuthorization(context, workspaceId);
    }
    if (db) {
      try {
        const rows = await db
          .select()
          .from(agentSessions)
          .where(and(eq(agentSessions.id, id), eq(agentSessions.workspaceId, workspaceId)));
        if (rows.length > 0 && rows[0]) {
          const r = rows[0];
          return {
            id: r.id,
            workspaceId: r.workspaceId,
            agentName: r.agentName,
            goal: r.goal,
            status: r.status as AgentSessionStatus,
            metadata: (r.metadata as Record<string, unknown>) ?? null,
            startedAt: r.startedAt?.toISOString() ?? null,
            completedAt: r.completedAt?.toISOString() ?? null,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString()
          };
        }
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentSessionOperation", err);
      }
    }

    const item = this.inMemorySessions.get(id);
    if (!item || item.workspaceId !== workspaceId) {
      return null;
    }
    return item;
  }

  public async listSessions(
    rawQuery: unknown,
    workspaceId: string = "ws_demo_default",
    db?: DbClient,
    context?: SessionContext
  ): Promise<AgentSessionListResult> {
    const query = AgentSessionQuerySchema.parse(rawQuery ?? {});
    const targetWorkspace = query.workspaceId || workspaceId;
    if (context) {
      requireWorkspaceAuthorization(context, targetWorkspace);
    }

    if (db) {
      try {
        const conditions = [eq(agentSessions.workspaceId, targetWorkspace)];
        if (query.status) conditions.push(eq(agentSessions.status, query.status));
        if (query.agentName) conditions.push(eq(agentSessions.agentName, query.agentName));
        if (query.search) {
          conditions.push(like(agentSessions.goal, `%${query.search}%`));
        }

        const rows = await db
          .select()
          .from(agentSessions)
          .where(and(...conditions))
          .orderBy(desc(agentSessions.createdAt))
          .limit(query.limit)
          .offset(query.offset);

        const countRes = await db
          .select({ count: sql<number>`count(*)` })
          .from(agentSessions)
          .where(and(...conditions));
        const total = Number(countRes[0]?.count ?? rows.length);

        const sessions: AgentSessionRecord[] = rows.map((r) => ({
          id: r.id,
          workspaceId: r.workspaceId,
          agentName: r.agentName,
          goal: r.goal,
          status: r.status as AgentSessionStatus,
          metadata: (r.metadata as Record<string, unknown>) ?? null,
          startedAt: r.startedAt?.toISOString() ?? null,
          completedAt: r.completedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString()
        }));

        return {
          sessions,
          total,
          offset: query.offset,
          limit: query.limit,
          hasMore: query.offset + query.limit < total
        };
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentSessionOperation", err);
      }
    }

    let items = Array.from(this.inMemorySessions.values()).filter(
      (s) => s.workspaceId === targetWorkspace
    );

    if (query.status) items = items.filter((s) => s.status === query.status);
    if (query.agentName) items = items.filter((s) => s.agentName === query.agentName);
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(
        (s) =>
          s.goal.toLowerCase().includes(q) ||
          s.agentName.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = items.length;
    const paginated = items.slice(query.offset, query.offset + query.limit);

    return {
      sessions: paginated,
      total,
      offset: query.offset,
      limit: query.limit,
      hasMore: query.offset + query.limit < total
    };
  }

  public async deleteSession(
    id: string,
    context: SessionContext,
    workspaceId: string = "ws_demo_default",
    db?: DbClient
  ): Promise<boolean> {
    requireOwnerAuthorization(context);
    requireWorkspaceAuthorization(context, workspaceId);
    const existing = await this.getSession(id, workspaceId, db, context);
    if (!existing) return false;

    if (db) {
      try {
        await db
          .delete(agentSessions)
          .where(and(eq(agentSessions.id, id), eq(agentSessions.workspaceId, workspaceId)));
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentSessionOperation", err);
      }
    }

    this.inMemorySessions.delete(id);
    return true;
  }
}

export const defaultAgentSessionService = new AgentSessionService();
