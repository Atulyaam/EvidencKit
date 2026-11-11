import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  SessionContext,
  requireOwnerAuthorization,
  requireWorkspaceAuthorization
} from "../authorization/index";
import {
  agentApprovals,
  DbClient,
  isDbConnectionError,
  assertInMemoryFallbackAllowed
} from "@evidencekit/db";
import { eq, and, desc } from "drizzle-orm";
import { defaultChainService } from "./chain-service";
import { AgentSessionService, defaultAgentSessionService } from "./agent-session-service";
import { EvidenceEvent } from "@evidencekit/core";

export const ApprovalDecisionSchema = z.enum(["approved", "rejected", "denied"]);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export const RequestApprovalInputSchema = z.object({
  sessionId: z.string().min(1),
  toolCallId: z.string().min(1),
  toolName: z.string().min(1).default("unknown"),
  operation: z.string().optional(),
  arguments: z.record(z.unknown()).optional(),
  reason: z.string().optional()
});
export type RequestApprovalInput = z.infer<typeof RequestApprovalInputSchema>;

export const DecideApprovalInputSchema = z.object({
  approvalId: z.string().min(1),
  decision: ApprovalDecisionSchema,
  reason: z.string().trim().max(1024).optional()
});
export type DecideApprovalInput = z.infer<typeof DecideApprovalInputSchema>;

export interface AgentApprovalRecord {
  id: string;
  sessionId: string;
  toolCallId: string;
  toolName: string;
  operation?: string | null;
  arguments?: Record<string, unknown> | null;
  decision: "pending" | "approved" | "rejected" | "denied";
  actorId: string;
  reason?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
}

export class AgentApprovalService {
  private inMemoryApprovals: Map<string, AgentApprovalRecord> = new Map();
  private rateLimitBuckets: Map<string, number[]> = new Map();

  constructor(private sessionService: AgentSessionService = defaultAgentSessionService) {}

  /**
   * Sliding window rate limiter to prevent automated approval storming and resource exhaustion.
   */
  private checkRateLimit(key: string, maxRequests = 60, windowMs = 60000): void {
    const now = Date.now();
    const timestamps = (this.rateLimitBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      throw new Error(
        `Rate limit exceeded: maximum ${maxRequests} approval operations per minute. Please throttle requests.`
      );
    }
    timestamps.push(now);
    this.rateLimitBuckets.set(key, timestamps);
  }

  public async requestApproval(
    input: unknown,
    context: SessionContext,
    workspaceId: string = "ws_demo_default",
    db?: DbClient
  ): Promise<AgentApprovalRecord> {
    requireWorkspaceAuthorization(context, workspaceId);
    const parsed = RequestApprovalInputSchema.parse(input);

    // Rate limit per session
    this.checkRateLimit(`req_${parsed.sessionId}`);

    const session = await this.sessionService.getSession(
      parsed.sessionId,
      workspaceId,
      db,
      context
    );
    if (!session) {
      throw new Error(`Session '${parsed.sessionId}' not found in workspace '${workspaceId}'`);
    }

    // Cap pending approvals per session to prevent approval flooding DoS (SEC-008)
    const existingPending = await this.listApprovals(parsed.sessionId, db);
    const pendingCount = existingPending.filter((a) => a.decision === "pending").length;
    if (pendingCount >= 50) {
      throw new Error(
        `Approval queue limit exceeded: session '${parsed.sessionId}' already has 50 pending approvals.`
      );
    }

    const now = new Date().toISOString();
    const approval: AgentApprovalRecord = {
      id: `appr_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      sessionId: parsed.sessionId,
      toolCallId: parsed.toolCallId,
      toolName: parsed.toolName,
      operation: parsed.operation || null,
      arguments: parsed.arguments ?? null,
      decision: "pending",
      actorId: "pending",
      reason: parsed.reason || null,
      requestedAt: now,
      decidedAt: null
    };

    if (db) {
      try {
        await db.insert(agentApprovals).values({
          id: approval.id,
          sessionId: approval.sessionId,
          toolCallId: approval.toolCallId,
          toolName: approval.toolName,
          operation: approval.operation,
          arguments: approval.arguments,
          decision: approval.decision,
          actorId: approval.actorId,
          reason: approval.reason,
          requestedAt: new Date(approval.requestedAt),
          decidedAt: null
        });
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentApprovalOperation", err);
      }
    }

    this.inMemoryApprovals.set(approval.id, approval);

    // Transition session to awaiting_approval
    try {
      await this.sessionService.updateSessionStatus(
        parsed.sessionId,
        "awaiting_approval",
        workspaceId,
        db
      );
    } catch {
      // ignore if already in transition
    }

    // Append canonical EvidenceKit event
    const approvalEv: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: parsed.sessionId,
      event_name: "agent.approval.requested",
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
      severity: "warning",
      correlation_ids: [parsed.toolCallId, approval.id],
      attributes: {
        approval_id: approval.id,
        tool_call_id: parsed.toolCallId,
        tool_name: parsed.toolName,
        operation: parsed.operation,
        arguments: parsed.arguments
      }
    };

    try {
      if (db) {
        await defaultChainService.appendTransactional(approvalEv, db);
      } else {
        defaultChainService.appendInMemory(approvalEv);
      }
    } catch {
      defaultChainService.appendInMemory(approvalEv);
    }

    return approval;
  }

  public async decideApproval(
    input: unknown,
    context: SessionContext,
    workspaceId: string = "ws_demo_default",
    db?: DbClient
  ): Promise<AgentApprovalRecord> {
    requireOwnerAuthorization(context);
    requireWorkspaceAuthorization(context, workspaceId);
    const parsed = DecideApprovalInputSchema.parse(input);

    // Rate limit decision operations per workspace
    this.checkRateLimit(`dec_${workspaceId}`);

    const existing = await this.getApproval(parsed.approvalId, db);
    if (!existing) {
      throw new Error(`Approval request '${parsed.approvalId}' not found`);
    }

    // Critical security check: Prevent duplicate approval, replay attack, race conditions
    if (existing.decision !== "pending") {
      throw new Error(
        `Approval request '${parsed.approvalId}' has already been decided (${existing.decision}) at ${existing.decidedAt}`
      );
    }

    // Verify session belongs to workspace
    const session = await this.sessionService.getSession(
      existing.sessionId,
      workspaceId,
      db,
      context
    );
    if (!session) {
      throw new Error(
        `Associated session '${existing.sessionId}' not found in workspace '${workspaceId}'`
      );
    }

    const now = new Date().toISOString();
    const decidedActor = context.userId || "owner";
    const updated: AgentApprovalRecord = {
      ...existing,
      decision: parsed.decision,
      actorId: decidedActor,
      reason: parsed.reason || existing.reason || null,
      decidedAt: now
    };

    if (db) {
      try {
        await db
          .update(agentApprovals)
          .set({
            decision: updated.decision,
            actorId: updated.actorId,
            reason: updated.reason,
            decidedAt: new Date(now)
          })
          .where(and(eq(agentApprovals.id, existing.id), eq(agentApprovals.decision, "pending")));
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentApprovalOperation", err);
      }
    }

    this.inMemoryApprovals.set(existing.id, updated);

    // Transition session back to running
    try {
      await this.sessionService.updateSessionStatus(existing.sessionId, "running", workspaceId, db);
    } catch {
      // ignore
    }

    // Append canonical EvidenceKit event
    const decidedEv: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: existing.sessionId,
      event_name: "agent.approval.decided",
      occurred_at: now,
      observed_at: now,
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "human_reviewer",
        id: decidedActor
      },
      severity: parsed.decision === "approved" ? "info" : "warning",
      correlation_ids: [existing.toolCallId, existing.id],
      attributes: {
        approval_id: existing.id,
        tool_call_id: existing.toolCallId,
        tool_name: existing.toolName,
        decision: parsed.decision,
        reason: updated.reason,
        actor_id: decidedActor
      }
    };

    try {
      if (db) {
        await defaultChainService.appendTransactional(decidedEv, db);
      } else {
        defaultChainService.appendInMemory(decidedEv);
      }
    } catch {
      defaultChainService.appendInMemory(decidedEv);
    }

    return updated;
  }

  public async getApproval(id: string, db?: DbClient): Promise<AgentApprovalRecord | null> {
    if (db) {
      try {
        const rows = await db.select().from(agentApprovals).where(eq(agentApprovals.id, id));
        if (rows.length > 0 && rows[0]) {
          const r = rows[0];
          return {
            id: r.id,
            sessionId: r.sessionId,
            toolCallId: r.toolCallId,
            toolName: r.toolName,
            operation: r.operation,
            arguments: (r.arguments as Record<string, unknown>) ?? null,
            decision: r.decision as "pending" | "approved" | "rejected",
            actorId: r.actorId,
            reason: r.reason,
            requestedAt: r.requestedAt.toISOString(),
            decidedAt: r.decidedAt?.toISOString() ?? null
          };
        }
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentApprovalOperation", err);
      }
    }

    return this.inMemoryApprovals.get(id) || null;
  }

  public async listApprovals(sessionId: string, db?: DbClient): Promise<AgentApprovalRecord[]> {
    if (db) {
      try {
        const rows = await db
          .select()
          .from(agentApprovals)
          .where(eq(agentApprovals.sessionId, sessionId))
          .orderBy(desc(agentApprovals.requestedAt));

        return rows.map((r) => ({
          id: r.id,
          sessionId: r.sessionId,
          toolCallId: r.toolCallId,
          toolName: r.toolName,
          operation: r.operation,
          arguments: (r.arguments as Record<string, unknown>) ?? null,
          decision: r.decision as "pending" | "approved" | "rejected",
          actorId: r.actorId,
          reason: r.reason,
          requestedAt: r.requestedAt.toISOString(),
          decidedAt: r.decidedAt?.toISOString() ?? null
        }));
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("agentApprovalOperation", err);
      }
    }

    return Array.from(this.inMemoryApprovals.values())
      .filter((a) => a.sessionId === sessionId)
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  public async getPendingApprovals(
    sessionId: string,
    db?: DbClient
  ): Promise<AgentApprovalRecord[]> {
    const list = await this.listApprovals(sessionId, db);
    return list.filter((a) => a.decision === "pending");
  }
}

export const defaultAgentApprovalService = new AgentApprovalService();
