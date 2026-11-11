import { describe, it, expect, beforeEach } from "vitest";
import {
  IncidentService,
  AgentSessionService,
  AgentApprovalService,
  EvidenceGraphService,
  SessionContext
} from "@evidencekit/evidence-server";

describe("Cross-Tenant Workspace Authorization & Isolation Suite (SEC-004)", () => {
  let incidentService: IncidentService;
  let sessionService: AgentSessionService;
  let approvalService: AgentApprovalService;
  let graphService: EvidenceGraphService;

  const tenantAContext: SessionContext = {
    userId: "usr_tenant_a",
    role: "owner",
    isOwner: true,
    isJudgeMode: false,
    authorizedWorkspaces: ["ws_tenant_a"]
  };

  const tenantBContext: SessionContext = {
    userId: "usr_tenant_b",
    role: "owner",
    isOwner: true,
    isJudgeMode: false,
    authorizedWorkspaces: ["ws_tenant_b"]
  };

  beforeEach(() => {
    incidentService = new IncidentService();
    sessionService = new AgentSessionService();
    approvalService = new AgentApprovalService(sessionService);
    graphService = new EvidenceGraphService();
  });

  it("strictly forbids tenant A from creating an incident in tenant B's workspace", async () => {
    await expect(
      incidentService.createIncident(
        {
          workspaceId: "ws_tenant_b",
          title: "Malicious Cross-Tenant Incident",
          severity: "high",
          environment: "production"
        },
        tenantAContext
      )
    ).rejects.toThrow(/Forbidden: Not authorized for workspace ws_tenant_b/);
  });

  it("strictly forbids tenant A from reading tenant B's incident", async () => {
    // Tenant B creates an incident
    const incidentB = await incidentService.createIncident(
      {
        workspaceId: "ws_tenant_b",
        title: "Confidential Tenant B Security Case",
        severity: "critical",
        environment: "production"
      },
      tenantBContext
    );

    // Tenant A attempts to fetch incident B
    await expect(
      incidentService.getIncident(incidentB.id, "ws_tenant_b", undefined, tenantAContext)
    ).rejects.toThrow(/Forbidden: Not authorized for workspace ws_tenant_b/);
  });

  it("strictly filters listIncidents queries to authorized workspace", async () => {
    await incidentService.createIncident(
      {
        workspaceId: "ws_tenant_a",
        title: "Incident Tenant A",
        severity: "low",
        environment: "dev"
      },
      tenantAContext
    );

    await incidentService.createIncident(
      {
        workspaceId: "ws_tenant_b",
        title: "Incident Tenant B",
        severity: "low",
        environment: "dev"
      },
      tenantBContext
    );

    // Tenant A cannot list tenant B's incidents
    await expect(
      incidentService.listIncidents(
        { workspaceId: "ws_tenant_b" },
        "ws_tenant_b",
        undefined,
        tenantAContext
      )
    ).rejects.toThrow(/Forbidden: Not authorized for workspace ws_tenant_b/);

    // Tenant A querying ws_tenant_a sees only their own incidents
    const listA = await incidentService.listIncidents({}, "ws_tenant_a", undefined, tenantAContext);
    expect(listA.incidents.every((i) => i.workspaceId === "ws_tenant_a")).toBe(true);
  });

  it("strictly forbids tenant A from creating an agent session in tenant B's workspace", async () => {
    await expect(
      sessionService.createSession(
        {
          workspaceId: "ws_tenant_b",
          agentName: "IntruderAgent",
          goal: "Snoop on tenant B data"
        },
        tenantAContext
      )
    ).rejects.toThrow(/Forbidden: Not authorized for workspace ws_tenant_b/);
  });

  it("strictly forbids tenant A from deciding approvals in tenant B's workspace", async () => {
    const sessionB = await sessionService.createSession(
      {
        workspaceId: "ws_tenant_b",
        agentName: "AgentB",
        goal: "Operate in workspace B"
      },
      tenantBContext
    );

    const approval = await approvalService.requestApproval(
      {
        sessionId: sessionB.id,
        toolCallId: "tc_123",
        toolName: "delete_database",
        reason: "Requesting destructive action"
      },
      tenantBContext,
      "ws_tenant_b"
    );

    // Tenant A attempts to approve or deny tenant B's gate
    await expect(
      approvalService.decideApproval(
        {
          approvalId: approval.id,
          decision: "approved",
          reason: "Unauthorized approval by tenant A"
        },
        tenantAContext,
        "ws_tenant_b"
      )
    ).rejects.toThrow(/Forbidden: Not authorized for workspace ws_tenant_b/);
  });

  it("strictly isolates evidence graph queries across workspaces", async () => {
    // Tenant A queries graph specifying tenant B workspace
    await expect(
      graphService.getEvidenceGraph({ workspaceId: "ws_tenant_b" }, undefined, tenantAContext)
    ).rejects.toThrow(/Forbidden: Not authorized for workspace ws_tenant_b/);
  });
});
