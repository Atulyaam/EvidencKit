import { describe, it, expect, afterAll } from "vitest";
import { getDb, getDbPool } from "../packages/db/src/index";
import {
  defaultAgentSessionService,
  defaultAgentApprovalService,
  defaultAgentSandboxService,
  defaultChainService,
  SessionContext
} from "../packages/evidence-server/src/index";
import fs from "node:fs";
import path from "node:path";

describe("Phase 4 — Agent Human Approval & Security Governance Suite", () => {
  afterAll(async () => {
    try {
      await getDbPool().end();
    } catch {
      // ignore
    }
  });

  const db = getDb();
  const workspaceId = `ws_appr_test_${Date.now()}`;
  const context: SessionContext = {
    userId: "usr_auditor_lead",
    role: "owner",
    isOwner: true,
    isJudgeMode: false
  };

  it("creates approval request with pending status and records canonical event", async () => {
    const session = await defaultAgentSessionService.createSession(
      {
        workspaceId,
        agentName: "ApprovalGateAgent",
        goal: "Test human approval workflow"
      },
      context,
      db
    );

    const approval = await defaultAgentApprovalService.requestApproval(
      {
        sessionId: session.id,
        toolCallId: "tc_req_001",
        toolName: "modify_file",
        operation: "modify",
        arguments: { path: "src/protected-config.ts" },
        reason: "Updating core security policies"
      },
      context,
      workspaceId,
      db
    );

    expect(approval.id).toBeDefined();
    expect(approval.decision).toBe("pending");
    expect(approval.toolCallId).toBe("tc_req_001");

    const retrieved = await defaultAgentApprovalService.getApproval(approval.id, db);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.decision).toBe("pending");
  });

  it("handles approval decision correctly and advances state", async () => {
    const session = await defaultAgentSessionService.createSession(
      {
        workspaceId,
        agentName: "ApprovalDecideAgent",
        goal: "Test approval decision transition"
      },
      context,
      db
    );

    const approval = await defaultAgentApprovalService.requestApproval(
      {
        sessionId: session.id,
        toolCallId: "tc_req_002",
        toolName: "modify_file",
        operation: "modify",
        arguments: { path: "src/config.ts" },
        reason: "Legitimate config update"
      },
      context,
      workspaceId,
      db
    );

    const decided = await defaultAgentApprovalService.decideApproval(
      {
        approvalId: approval.id,
        decision: "approved",
        reason: "Reviewed by Lead SecOps Engineer"
      },
      context,
      workspaceId,
      db
    );

    expect(decided.decision).toBe("approved");
    expect(decided.decidedAt).toBeDefined();

    // Verify session events reflect the decision
    const events = await defaultChainService.getEventsFromDb(session.id, db);
    const decideEvent = events.find((e) => e.event.event_name === "agent.approval.decided");
    expect(decideEvent).toBeDefined();
    expect(decideEvent?.event.attributes.decision).toBe("approved");
    expect(decideEvent?.event.attributes.approval_id).toBe(approval.id);
  });

  it("strictly enforces zero mutation on denial", async () => {
    const session = await defaultAgentSessionService.createSession(
      {
        workspaceId,
        agentName: "DenialEnforceAgent",
        goal: "Verify zero mutation on human denial"
      },
      context,
      db
    );

    // Initialize sandbox
    const sandboxDir = defaultAgentSandboxService.initSandbox(session.id);
    const protectedPath = path.join(sandboxDir, "src", "protected-config.ts");
    const originalContent = fs.readFileSync(protectedPath, "utf8");
    const originalHash = defaultAgentSandboxService.computeFileHash(protectedPath);

    // Create approval request for malicious change
    const approval = await defaultAgentApprovalService.requestApproval(
      {
        sessionId: session.id,
        toolCallId: "tc_attack_003",
        toolName: "modify_file",
        operation: "modify",
        arguments: {
          path: "src/protected-config.ts",
          content: "export const malicious = true;"
        },
        reason: "Unauthorized privilege escalation"
      },
      context,
      workspaceId,
      db
    );

    // Human operator DENIES the request
    const decided = await defaultAgentApprovalService.decideApproval(
      {
        approvalId: approval.id,
        decision: "denied",
        reason: "Security violation detected: Disabling MFA is prohibited by SOC 2 policy"
      },
      context,
      workspaceId,
      db
    );

    expect(decided.decision).toBe("denied");

    // Attempt to execute tool with denied approval must fail
    const execResult = await defaultAgentSandboxService.executeTool({
      sessionId: session.id,
      agentName: session.agentName,
      toolCallId: "tc_attack_003",
      toolName: "modify_file",
      args: {
        path: "src/protected-config.ts",
        content: "export const malicious = true;"
      },
      approvalId: approval.id,
      db
    });

    expect(execResult.success).toBe(false);
    expect(execResult.error).toMatch(/Authorization denied/i);

    // ZERO MUTATION GUARANTEE: file content and file hash must be 100% unchanged
    const currentContent = fs.readFileSync(protectedPath, "utf8");
    const currentHash = defaultAgentSandboxService.computeFileHash(protectedPath);
    expect(currentContent).toBe(originalContent);
    expect(currentHash).toBe(originalHash);
  });

  it("prevents double-decision replay attacks on already-decided approvals", async () => {
    const session = await defaultAgentSessionService.createSession(
      {
        workspaceId,
        agentName: "AntiReplayAgent",
        goal: "Prevent duplicate approval decisions"
      },
      context,
      db
    );

    const approval = await defaultAgentApprovalService.requestApproval(
      {
        sessionId: session.id,
        toolCallId: "tc_replay_004",
        toolName: "modify_file",
        operation: "modify",
        arguments: { path: "src/config.ts" },
        reason: "Initial approval"
      },
      context,
      workspaceId,
      db
    );

    // First decision: denied
    await defaultAgentApprovalService.decideApproval(
      {
        approvalId: approval.id,
        decision: "denied",
        reason: "Initial denial"
      },
      context,
      workspaceId,
      db
    );

    // Second decision attempt on same approval must be rejected
    await expect(
      defaultAgentApprovalService.decideApproval(
        {
          approvalId: approval.id,
          decision: "approved",
          reason: "Attempting to overwrite denial"
        },
        context,
        workspaceId,
        db
      )
    ).rejects.toThrow(/(already been decided|already decided)/i);
  });
});
