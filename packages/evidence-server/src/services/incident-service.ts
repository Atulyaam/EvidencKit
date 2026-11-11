import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  SessionContext,
  requireOwnerAuthorization,
  requireWorkspaceAuthorization
} from "../authorization/index";
import {
  cases,
  workspaces,
  DbClient,
  isDbConnectionError,
  assertInMemoryFallbackAllowed
} from "@evidencekit/db";
import { eq, and, desc, sql, like } from "drizzle-orm";

export const IncidentSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export const IncidentStatusSchema = z.enum([
  "open",
  "investigating",
  "mitigated",
  "resolved",
  "closed"
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const CreateIncidentInputSchema = z.object({
  workspaceId: z.string().min(1).default("ws_demo_default"),
  title: z.string().trim().min(3).max(256),
  description: z.string().trim().max(4096).optional(),
  severity: IncidentSeveritySchema.default("high"),
  environment: z.string().trim().min(1).max(64).default("production")
});
export type CreateIncidentInput = z.infer<typeof CreateIncidentInputSchema>;

export const UpdateIncidentInputSchema = z.object({
  title: z.string().trim().min(3).max(256).optional(),
  description: z.string().trim().max(4096).nullable().optional(),
  severity: IncidentSeveritySchema.optional(),
  environment: z.string().trim().min(1).max(64).optional(),
  status: IncidentStatusSchema.optional()
});
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentInputSchema>;

export const IncidentQuerySchema = z.object({
  search: z.string().optional(),
  status: IncidentStatusSchema.optional(),
  severity: IncidentSeveritySchema.optional(),
  environment: z.string().optional(),
  workspaceId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
export type IncidentQuery = z.infer<typeof IncidentQuerySchema>;

export interface IncidentRecord {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  environment: string;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentListResult {
  incidents: IncidentRecord[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export class IncidentService {
  private inMemoryCases: Map<string, IncidentRecord> = new Map();

  constructor() {
    // Seed initial demo incident in memory
    const defaultIncident: IncidentRecord = {
      id: "case_01HZX9QK2M",
      workspaceId: "ws_demo_default",
      title: "Production DB Migration Lock & Latency Spike",
      description: "Automated migration introduced table lock on users table causing API timeouts.",
      severity: "critical",
      environment: "production",
      status: "investigating",
      createdAt: "2026-11-16T10:00:00.000Z",
      updatedAt: "2026-11-16T10:15:00.000Z"
    };
    this.inMemoryCases.set(defaultIncident.id, defaultIncident);
  }

  public async createIncident(
    input: unknown,
    context: SessionContext,
    db?: DbClient
  ): Promise<IncidentRecord> {
    requireOwnerAuthorization(context);
    const parsed = CreateIncidentInputSchema.parse(input);
    requireWorkspaceAuthorization(context, parsed.workspaceId);

    const now = new Date().toISOString();
    const id = `case_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

    const incident: IncidentRecord = {
      id,
      workspaceId: parsed.workspaceId,
      title: parsed.title,
      description: parsed.description ?? null,
      severity: parsed.severity,
      environment: parsed.environment,
      status: "open",
      createdAt: now,
      updatedAt: now
    };

    if (db) {
      try {
        await db
          .insert(workspaces)
          .values({
            id: incident.workspaceId,
            name: `Workspace ${incident.workspaceId}`
          })
          .onConflictDoNothing();

        await db.insert(cases).values({
          id: incident.id,
          workspaceId: incident.workspaceId,
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
          environment: incident.environment,
          status: incident.status,
          createdAt: new Date(incident.createdAt),
          updatedAt: new Date(incident.updatedAt)
        });
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("createIncident", err);
      }
    }

    this.inMemoryCases.set(incident.id, incident);
    return incident;
  }

  public async getIncident(
    id: string,
    workspaceId: string = "ws_demo_default",
    db?: DbClient,
    context?: SessionContext
  ): Promise<IncidentRecord | null> {
    if (context) {
      requireWorkspaceAuthorization(context, workspaceId);
    }
    if (db) {
      try {
        const rows = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, id), eq(cases.workspaceId, workspaceId)));
        if (rows.length > 0 && rows[0]) {
          const r = rows[0];
          return {
            id: r.id,
            workspaceId: r.workspaceId,
            title: r.title,
            description: r.description,
            severity: r.severity as IncidentSeverity,
            environment: r.environment,
            status: r.status as IncidentStatus,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString()
          };
        }
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("createIncident", err);
      }
    }

    const item = this.inMemoryCases.get(id);
    if (!item || item.workspaceId !== workspaceId) {
      return null;
    }
    return item;
  }

  public async listIncidents(
    rawQuery: unknown,
    workspaceId: string = "ws_demo_default",
    db?: DbClient,
    context?: SessionContext
  ): Promise<IncidentListResult> {
    const query = IncidentQuerySchema.parse(rawQuery ?? {});
    const targetWorkspace = query.workspaceId || workspaceId;
    if (context) {
      requireWorkspaceAuthorization(context, targetWorkspace);
    }

    if (db) {
      try {
        const conditions = [eq(cases.workspaceId, targetWorkspace)];
        if (query.status) conditions.push(eq(cases.status, query.status));
        if (query.severity) conditions.push(eq(cases.severity, query.severity));
        if (query.environment) conditions.push(eq(cases.environment, query.environment));
        if (query.search) {
          conditions.push(like(cases.title, `%${query.search}%`));
        }

        const rows = await db
          .select()
          .from(cases)
          .where(and(...conditions))
          .orderBy(desc(cases.createdAt))
          .limit(query.limit)
          .offset(query.offset);

        const countRes = await db
          .select({ count: sql<number>`count(*)` })
          .from(cases)
          .where(and(...conditions));
        const total = Number(countRes[0]?.count ?? rows.length);

        const incidents: IncidentRecord[] = rows.map((r) => ({
          id: r.id,
          workspaceId: r.workspaceId,
          title: r.title,
          description: r.description,
          severity: r.severity as IncidentSeverity,
          environment: r.environment,
          status: r.status as IncidentStatus,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString()
        }));

        return {
          incidents,
          total,
          offset: query.offset,
          limit: query.limit,
          hasMore: query.offset + query.limit < total
        };
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("createIncident", err);
      }
    }

    let items = Array.from(this.inMemoryCases.values()).filter(
      (c) => c.workspaceId === targetWorkspace
    );

    if (query.status) {
      items = items.filter((c) => c.status === query.status);
    }
    if (query.severity) {
      items = items.filter((c) => c.severity === query.severity);
    }
    if (query.environment) {
      items = items.filter((c) => c.environment.toLowerCase() === query.environment!.toLowerCase());
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = items.length;
    const paginated = items.slice(query.offset, query.offset + query.limit);

    return {
      incidents: paginated,
      total,
      offset: query.offset,
      limit: query.limit,
      hasMore: query.offset + query.limit < total
    };
  }

  public async updateIncident(
    id: string,
    input: unknown,
    context: SessionContext,
    workspaceId: string = "ws_demo_default",
    db?: DbClient
  ): Promise<IncidentRecord> {
    requireOwnerAuthorization(context);
    requireWorkspaceAuthorization(context, workspaceId);
    const parsed = UpdateIncidentInputSchema.parse(input);

    const existing = await this.getIncident(id, workspaceId, db, context);
    if (!existing) {
      throw new Error(`Incident '${id}' not found in workspace '${workspaceId}'`);
    }

    const now = new Date().toISOString();
    const updated: IncidentRecord = {
      ...existing,
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.severity !== undefined ? { severity: parsed.severity } : {}),
      ...(parsed.environment !== undefined ? { environment: parsed.environment } : {}),
      ...(parsed.status !== undefined ? { status: parsed.status } : {}),
      updatedAt: now
    };

    if (db) {
      try {
        await db
          .update(cases)
          .set({
            title: updated.title,
            description: updated.description,
            severity: updated.severity,
            environment: updated.environment,
            status: updated.status,
            updatedAt: new Date(now)
          })
          .where(and(eq(cases.id, id), eq(cases.workspaceId, workspaceId)));
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("createIncident", err);
      }
    }

    this.inMemoryCases.set(id, updated);
    return updated;
  }

  public async deleteIncident(
    id: string,
    context: SessionContext,
    workspaceId: string = "ws_demo_default",
    db?: DbClient
  ): Promise<boolean> {
    requireOwnerAuthorization(context);
    requireWorkspaceAuthorization(context, workspaceId);
    const existing = await this.getIncident(id, workspaceId, db, context);
    if (!existing) {
      return false;
    }

    if (db) {
      try {
        await db.delete(cases).where(and(eq(cases.id, id), eq(cases.workspaceId, workspaceId)));
      } catch (err: any) {
        if (!isDbConnectionError(err)) throw err;
        assertInMemoryFallbackAllowed("createIncident", err);
      }
    }

    this.inMemoryCases.delete(id);
    return true;
  }
}

export const defaultIncidentService = new IncidentService();
