import { describe, it, expect, beforeEach } from "vitest";
import { IncidentService, SessionContext, CreateIncidentInput } from "@evidencekit/evidence-server";

describe("Phase 3 — Task 3.2: Incident Management Service", () => {
  let service: IncidentService;
  const ownerContext: SessionContext = {
    userId: "owner-user",
    role: "owner",
    isOwner: true,
    isJudgeMode: false
  };

  const judgeContext: SessionContext = {
    role: "judge",
    isOwner: false,
    isJudgeMode: true
  };

  beforeEach(() => {
    service = new IncidentService();
  });

  it("creates a new incident with valid parameters as owner", async () => {
    const input: CreateIncidentInput = {
      workspaceId: "ws_test_01",
      title: "API Gateway 502 Outage",
      description: "Downstream rate limiting caused nginx upstream connection timeouts",
      severity: "critical",
      environment: "production"
    };

    const incident = await service.createIncident(input, ownerContext);

    expect(incident.id).toMatch(/^case_[0-9a-f]{12}$/);
    expect(incident.title).toBe(input.title);
    expect(incident.severity).toBe("critical");
    expect(incident.status).toBe("open");
    expect(incident.createdAt).toBeDefined();
    expect(incident.updatedAt).toBeDefined();
  });

  it("rejects incident creation from unauthenticated/judge session", async () => {
    const input = {
      workspaceId: "ws_test_01",
      title: "Unauthorized incident creation attempt"
    };

    await expect(service.createIncident(input, judgeContext)).rejects.toThrow(
      /Public Judge Mode is strictly READ-ONLY/
    );
  });

  it("rejects invalid input schema (short title, bad severity)", async () => {
    const invalidInput = {
      workspaceId: "ws_test_01",
      title: "ab", // min 3
      severity: "super-extreme-critical" // invalid enum
    };

    await expect(service.createIncident(invalidInput, ownerContext)).rejects.toThrow();
  });

  it("retrieves an existing incident by ID and workspace", async () => {
    const incident = await service.createIncident(
      {
        workspaceId: "ws_test_01",
        title: "Redis Cache Eviction Surge",
        severity: "medium"
      },
      ownerContext
    );

    const fetched = await service.getIncident(incident.id, "ws_test_01");
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(incident.id);
    expect(fetched?.title).toBe("Redis Cache Eviction Surge");
  });

  it("enforces cross-workspace isolation (cannot access incident from another workspace)", async () => {
    const incident = await service.createIncident(
      {
        workspaceId: "ws_tenant_alpha",
        title: "Confidential Security Investigation",
        severity: "critical"
      },
      ownerContext
    );

    // Querying from tenant beta returns null
    const fetched = await service.getIncident(incident.id, "ws_tenant_beta");
    expect(fetched).toBeNull();
  });

  it("filters and searches incidents with pagination", async () => {
    const ws = "ws_pagination_test";
    for (let i = 1; i <= 5; i++) {
      await service.createIncident(
        {
          workspaceId: ws,
          title: `Incident ${i} ${i % 2 === 0 ? "Database" : "Network"} Alert`,
          severity: i === 1 ? "critical" : "high",
          environment: "production"
        },
        ownerContext
      );
    }

    // Filter by search keyword
    const dbSearch = await service.listIncidents({ search: "Database" }, ws);
    expect(dbSearch.incidents.length).toBe(2);
    expect(dbSearch.total).toBe(2);

    // Filter by severity
    const criticals = await service.listIncidents({ severity: "critical" }, ws);
    expect(criticals.incidents.length).toBe(1);

    // Pagination test
    const page1 = await service.listIncidents({ limit: 2, offset: 0 }, ws);
    expect(page1.incidents.length).toBe(2);
    expect(page1.total).toBe(5);
    expect(page1.hasMore).toBe(true);

    const page3 = await service.listIncidents({ limit: 2, offset: 4 }, ws);
    expect(page3.incidents.length).toBe(1);
    expect(page3.hasMore).toBe(false);
  });

  it("updates incident status, severity, and description", async () => {
    const incident = await service.createIncident(
      {
        workspaceId: "ws_test_01",
        title: "Initial Draft Title",
        severity: "low"
      },
      ownerContext
    );

    const updated = await service.updateIncident(
      incident.id,
      {
        title: "Updated Validated Title",
        severity: "high",
        status: "investigating",
        description: "Confirmed root cause in third-party webhook provider."
      },
      ownerContext,
      "ws_test_01"
    );

    expect(updated.title).toBe("Updated Validated Title");
    expect(updated.severity).toBe("high");
    expect(updated.status).toBe("investigating");
    expect(updated.description).toContain("third-party webhook provider");
  });

  it("deletes an incident as owner", async () => {
    const incident = await service.createIncident(
      {
        workspaceId: "ws_test_01",
        title: "Incident to be deleted"
      },
      ownerContext
    );

    const deleted = await service.deleteIncident(incident.id, ownerContext, "ws_test_01");
    expect(deleted).toBe(true);

    const fetched = await service.getIncident(incident.id, "ws_test_01");
    expect(fetched).toBeNull();
  });
});
