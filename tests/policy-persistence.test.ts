import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, getDbPool, checkDbHealth, policies, workspaces, eq } from "@evidencekit/db";
import { AgentPolicyService } from "@evidencekit/evidence-server";

describe("Agent Policy PostgreSQL Persistence & Isolation Suite (SEC-007)", () => {
  let isDbAlive = false;
  let db: any;
  const ws1 = `ws_pol_pers_a_${Date.now()}`;
  const ws2 = `ws_pol_pers_b_${Date.now()}`;

  beforeAll(async () => {
    isDbAlive = await checkDbHealth(1500);
    if (isDbAlive) {
      db = getDb();
    }
  });

  afterAll(async () => {
    if (isDbAlive && db) {
      await db
        .delete(policies)
        .where(eq(policies.workspaceId, ws1))
        .catch(() => {});
      await db
        .delete(policies)
        .where(eq(policies.workspaceId, ws2))
        .catch(() => {});
      await db
        .delete(workspaces)
        .where(eq(workspaces.id, ws1))
        .catch(() => {});
      await db
        .delete(workspaces)
        .where(eq(workspaces.id, ws2))
        .catch(() => {});
      await getDbPool()
        .end()
        .catch(() => {});
    }
  });

  it("persists policy versions to PostgreSQL policies table and survives server restart", async () => {
    if (!isDbAlive) {
      console.warn("PostgreSQL not reachable; skipping live DB test.");
      return;
    }

    const policyService = new AgentPolicyService();

    // 1. Save policy in workspace 1
    const saved = await policyService.savePolicyVersion(
      ws1,
      {
        version: "1.1.0",
        workspaceId: ws1,
        name: "Security Guard Policy",
        description: "Enforces strict human approval on write operations",
        defaultDecision: "REQUIRE_APPROVAL",
        rules: [
          {
            id: "rule_strict_write",
            name: "Strict Write Gate",
            tool: "modify_file",
            operation: "write",
            action: "REQUIRE_APPROVAL",
            riskLevel: "high",
            reason: "All writes require human signoff",
            precedence: 10
          }
        ]
      },
      db
    );

    expect(saved.id).toBeDefined();
    expect(saved.version).toBe("1.1.0");

    // 2. Query direct from PostgreSQL database
    const dbRows = await db.select().from(policies).where(eq(policies.id, saved.id));
    expect(dbRows).toHaveLength(1);
    expect(dbRows[0].name).toBe("Security Guard Policy");
    expect(dbRows[0].workspaceId).toBe(ws1);
    expect(dbRows[0].rules).toEqual(saved.rules);

    // 3. Emulate application restart with a completely fresh, uninitialized service instance
    const freshService = new AgentPolicyService();
    const loadedPolicies = await freshService.getPoliciesForWorkspace(ws1, db);

    expect(loadedPolicies.some((p) => p.id === saved.id)).toBe(true);
    const retrieved = loadedPolicies.find((p) => p.id === saved.id);
    expect(retrieved?.name).toBe("Security Guard Policy");
  });

  it("strictly enforces workspace isolation on persisted policies", async () => {
    if (!isDbAlive) return;

    const policyService = new AgentPolicyService();

    await policyService.savePolicyVersion(
      ws1,
      {
        version: "1.0.0",
        workspaceId: ws1,
        name: "Workspace 1 Secret Policy",
        description: "Private policy",
        defaultDecision: "DENY",
        rules: []
      },
      db
    );

    await policyService.savePolicyVersion(
      ws2,
      {
        version: "1.0.0",
        workspaceId: ws2,
        name: "Workspace 2 Public Policy",
        description: "Public policy",
        defaultDecision: "ALLOW",
        rules: []
      },
      db
    );

    const freshService = new AgentPolicyService();
    const ws1Policies = await freshService.getPoliciesForWorkspace(ws1, db);
    const ws2Policies = await freshService.getPoliciesForWorkspace(ws2, db);

    expect(ws1Policies.every((p) => p.workspaceId === ws1)).toBe(true);
    expect(ws2Policies.every((p) => p.workspaceId === ws2)).toBe(true);
    expect(ws1Policies.some((p) => p.name.includes("Workspace 2"))).toBe(false);
  });
});
