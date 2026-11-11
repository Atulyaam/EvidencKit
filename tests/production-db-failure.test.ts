import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  IncidentService,
  AgentSessionService,
  AgentPolicyService,
  ChainService,
  SessionContext
} from "@evidencekit/evidence-server";
import { DatabaseUnavailableError, DbClient, getDb, resetDbPool } from "@evidencekit/db";
import { EvidenceEvent } from "@evidencekit/core";
import { randomUUID } from "node:crypto";

describe("Production PostgreSQL Failure & Zero In-Memory Fallback Suite (CRITICAL)", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalStrict = process.env.STRICT_PERSISTENCE;
  let brokenDb: DbClient;

  const ownerContext: SessionContext = {
    userId: "prod_admin",
    role: "owner",
    isOwner: true,
    isJudgeMode: false,
    authorizedWorkspaces: ["ws_prod_01"]
  };

  beforeEach(() => {
    // Connect to closed offline port with fast timeout
    resetDbPool();
    brokenDb = getDb("postgresql://postgres:postgres@127.0.0.1:54329/nonexistent");
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    process.env.STRICT_PERSISTENCE = originalStrict;
    resetDbPool();
  });

  it("strictly throws DatabaseUnavailableError during incident creation in production mode", async () => {
    process.env.NODE_ENV = "production";
    const incidentService = new IncidentService();

    const start = performance.now();
    await expect(
      incidentService.createIncident(
        {
          workspaceId: "ws_prod_01",
          title: "Production Outage Incident",
          severity: "critical",
          environment: "production"
        },
        ownerContext,
        brokenDb
      )
    ).rejects.toThrowError(DatabaseUnavailableError);
    const duration = performance.now() - start;

    // Fast fail: should fail within connection timeout (< 2000ms)
    expect(duration).toBeLessThan(2000);

    // Verify ZERO in-memory leakage occurred
    const inMemList = await incidentService.listIncidents({}, "ws_prod_01");
    expect(
      inMemList.incidents.filter((i) => i.title === "Production Outage Incident")
    ).toHaveLength(0);
  });

  it("strictly throws DatabaseUnavailableError during agent session creation in production mode", async () => {
    process.env.NODE_ENV = "production";
    const sessionService = new AgentSessionService();

    const start = performance.now();
    await expect(
      sessionService.createSession(
        {
          workspaceId: "ws_prod_01",
          agentName: "CriticalProdAgent",
          goal: "Execute database transaction"
        },
        ownerContext,
        brokenDb
      )
    ).rejects.toThrowError(DatabaseUnavailableError);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(2000);
    const inMemSessions = await sessionService.listSessions({}, "ws_prod_01");
    expect(inMemSessions.sessions.filter((s) => s.agentName === "CriticalProdAgent")).toHaveLength(
      0
    );
  });

  it("strictly throws DatabaseUnavailableError during transactional hash-chain append in production mode", async () => {
    process.env.NODE_ENV = "production";
    const chainService = new ChainService();

    const testEvent: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: "stream_prod_test",
      event_name: "agent.sandbox.executed",
      occurred_at: new Date().toISOString(),
      observed_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: { system: "agent", adapter: "test", adapter_version: "1.0" },
      severity: "info",
      attributes: { action: "deploy" }
    };

    const start = performance.now();
    await expect(chainService.appendTransactional(testEvent, brokenDb)).rejects.toThrowError(
      DatabaseUnavailableError
    );
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(2000);

    // Verify stream was NOT silently appended to in-memory store
    expect(chainService.getEventsInMemory("stream_prod_test")).toHaveLength(0);
  });

  it("strictly throws DatabaseUnavailableError during policy save in production mode", async () => {
    process.env.NODE_ENV = "production";
    const policyService = new AgentPolicyService();

    await expect(
      policyService.savePolicyVersion(
        "ws_prod_01",
        {
          version: "2.0.0",
          workspaceId: "ws_prod_01",
          name: "Strict Production Policy",
          description: "Production policy",
          defaultDecision: "REQUIRE_APPROVAL",
          rules: []
        },
        brokenDb
      )
    ).rejects.toThrowError(DatabaseUnavailableError);
  });

  it("preserves explicitly configured test-only in-memory storage when db is omitted", async () => {
    // In test environment without db client passed, services function as pure in-memory test adapters
    process.env.NODE_ENV = "test";
    const incidentService = new IncidentService();

    const incident = await incidentService.createIncident(
      {
        workspaceId: "ws_prod_01",
        title: "Test Adapter Incident",
        severity: "low",
        environment: "staging"
      },
      ownerContext
    );

    expect(incident.id).toBeDefined();
    expect(incident.title).toBe("Test Adapter Incident");

    const fetched = await incidentService.getIncident(incident.id, "ws_prod_01");
    expect(fetched?.title).toBe("Test Adapter Incident");
  });
});
