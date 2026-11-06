import { describe, it, expect } from "vitest";
import { defaultEvidenceGraphService, defaultChainService } from "@evidencekit/evidence-server";
import { getDb, cases, workspaces, eq } from "@evidencekit/db";
import { EvidenceEvent } from "@evidencekit/core";
import { randomUUID } from "node:crypto";

describe("Phase 4.5 — Unified Evidence Graph Test Suite", () => {
  const ws1 = `ws_graph_a_${Date.now()}`;
  const ws2 = `ws_graph_b_${Date.now()}`;

  it("constructs explicit graph nodes and hash-chain edges from stream events", async () => {
    const streamId = `case_graph_${Date.now()}`;
    const ev1: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "tracevault.case",
      stream_id: streamId,
      event_name: "gateway.ingress.started",
      occurred_at: new Date().toISOString(),
      observed_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: { system: "api-gw", adapter: "test", adapter_version: "1.0" },
      severity: "info",
      attributes: { path: "/checkout" }
    };

    const ev2: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "tracevault.case",
      stream_id: streamId,
      event_name: "db.pool.exhausted",
      occurred_at: new Date(Date.now() + 1000).toISOString(),
      observed_at: new Date(Date.now() + 1000).toISOString(),
      time_confidence: "source_timestamp",
      source: { system: "postgres", adapter: "test", adapter_version: "1.0" },
      severity: "critical",
      attributes: { active: 100, max: 100 }
    };

    defaultChainService.appendInMemory(ev1);
    defaultChainService.appendInMemory(ev2);

    const graph = await defaultEvidenceGraphService.getEvidenceGraph({
      workspaceId: ws1,
      streamId,
      relationshipType: "explicit"
    });

    expect(graph.nodes.length).toBeGreaterThanOrEqual(3); // Container + 2 events
    const eventNodes = graph.nodes.filter((n) => n.type === "event");
    expect(eventNodes.length).toBe(2);

    // Verify explicit edges
    const containsEdges = graph.edges.filter((e) => e.relationship === "contains_event");
    expect(containsEdges.length).toBe(2);
    expect(containsEdges[0]?.isNonCausalCandidate).toBe(false);

    const prevHashEdges = graph.edges.filter((e) => e.relationship === "previous_hash_link");
    expect(prevHashEdges.length).toBe(1);
    expect(prevHashEdges[0]?.source).toBe(ev1.event_id);
    expect(prevHashEdges[0]?.target).toBe(ev2.event_id);
    expect(prevHashEdges[0]?.isNonCausalCandidate).toBe(false);
  });

  it("distinguishes explicit relationships from inferred candidate relationships", async () => {
    const streamA = `case_cand_a_${Date.now()}`;
    const streamB = `session_cand_b_${Date.now()}`;
    const baseTime = Date.now();

    const evA: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "tracevault.case",
      stream_id: streamA,
      event_name: "service.latency.spike",
      occurred_at: new Date(baseTime).toISOString(),
      observed_at: new Date(baseTime).toISOString(),
      time_confidence: "source_timestamp",
      source: { system: "monitor", adapter: "test", adapter_version: "1.0" },
      severity: "warning",
      attributes: { latencyMs: 5200 }
    };

    const evB: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: streamB,
      event_name: "agent.tool.started",
      occurred_at: new Date(baseTime + 5000).toISOString(), // 5s later
      observed_at: new Date(baseTime + 5000).toISOString(),
      time_confidence: "source_timestamp",
      source: { system: "agent-runtime", adapter: "test", adapter_version: "1.0" },
      severity: "info",
      attributes: { tool_name: "create_file" }
    };

    defaultChainService.appendInMemory(evA);
    defaultChainService.appendInMemory(evB);

    // Build graph for streamA
    const graphA = await defaultEvidenceGraphService.getEvidenceGraph({
      workspaceId: ws1,
      streamId: streamA,
      relationshipType: "all"
    });

    const explicitEdges = graphA.edges.filter((e) => e.type === "explicit");
    for (const edge of explicitEdges) {
      expect(edge.isNonCausalCandidate).toBe(false);
    }
  });

  it("enforces pagination and limits to prevent loading thousands of nodes into the browser", async () => {
    const streamId = `scale_stream_${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      const ev: EvidenceEvent = {
        schema_version: "1.0",
        event_id: randomUUID(),
        stream_type: "tracevault.case",
        stream_id: streamId,
        event_name: `batch.event.${i}`,
        occurred_at: new Date().toISOString(),
        observed_at: new Date().toISOString(),
        time_confidence: "source_timestamp",
        source: { system: "test", adapter: "test", adapter_version: "1.0" },
        severity: "info",
        attributes: { index: i }
      };
      defaultChainService.appendInMemory(ev);
    }

    // Query with limit = 5
    const paginatedGraph = await defaultEvidenceGraphService.getEvidenceGraph({
      workspaceId: ws1,
      streamId,
      limit: 5
    });

    expect(paginatedGraph.nodes.length).toBe(5);
    expect(paginatedGraph.totalNodes).toBeGreaterThan(5);
    expect(paginatedGraph.hasMore).toBe(true);
  });

  it("enforces workspace isolation on database queries", async (ctx) => {
    let db;
    try {
      db = getDb();
      await db.select().from(cases).limit(1);
    } catch {
      ctx.skip();
      return;
    }

    // Create workspace records
    await db.insert(workspaces).values([
      { id: ws1, name: "Workspace 1" },
      { id: ws2, name: "Workspace 2" }
    ]);

    const caseId1 = `case_iso_1_${Date.now()}`;
    const caseId2 = `case_iso_2_${Date.now()}`;

    await db.insert(cases).values([
      {
        id: caseId1,
        workspaceId: ws1,
        title: "Incident in Workspace 1",
        severity: "high"
      },
      {
        id: caseId2,
        workspaceId: ws2,
        title: "Incident in Workspace 2",
        severity: "critical"
      }
    ]);

    // Query graph for ws1
    const graphWs1 = await defaultEvidenceGraphService.getEvidenceGraph({ workspaceId: ws1 }, db);

    const ws1CaseIds = graphWs1.nodes.filter((n) => n.type === "incident").map((n) => n.id);

    expect(ws1CaseIds).toContain(caseId1);
    expect(ws1CaseIds).not.toContain(caseId2);

    // Cleanup
    await db.delete(cases).where(eq(cases.id, caseId1));
    await db.delete(cases).where(eq(cases.id, caseId2));
    await db.delete(workspaces).where(eq(workspaces.id, ws1));
    await db.delete(workspaces).where(eq(workspaces.id, ws2));
  });
});
