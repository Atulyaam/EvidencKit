import { describe, it, expect, afterAll } from "vitest";
import { getDb, getDbPool, agentSessions, eq } from "../packages/db/src/index";
import {
  defaultAgentSessionService,
  defaultAgentApprovalService,
  defaultAgentSandboxService,
  defaultAgentReplayService,
  defaultAgentDemoService,
  defaultChainService,
  SessionContext
} from "../packages/evidence-server/src/index";
import fs from "node:fs";

describe("Phase 4 — AgentLedger Backend Integration Test Suite", () => {
  afterAll(async () => {
    try {
      await getDbPool().end();
    } catch {
      // ignore
    }
  });

  const testWorkspace = `ws_al_test_${Date.now()}`;
  const isolatedWorkspace = `ws_al_iso_${Date.now()}`;
  const ownerContext: SessionContext = {
    userId: "al-owner-test",
    role: "owner",
    isOwner: true,
    isJudgeMode: false
  };
  const judgeContext: SessionContext = {
    userId: undefined,
    role: "judge",
    isOwner: false,
    isJudgeMode: true
  };

  it("Task 4.2 — creates and manages session lifecycle with state machine validation and PostgreSQL persistence", async () => {
    const db = getDb();

    // 1. Create Session
    const session = await defaultAgentSessionService.createSession(
      {
        workspaceId: testWorkspace,
        agentName: "code-optimizer",
        goal: "Refactor database query indexes and connection pool configuration",
        metadata: { model: "claude-3-5-sonnet", environment: "staging" }
      },
      ownerContext,
      db
    );

    expect(session.id).toBeDefined();
    expect(session.status).toBe("created");
    expect(session.workspaceId).toBe(testWorkspace);

    // Verify row directly in PostgreSQL table
    const dbRows = await db.select().from(agentSessions).where(eq(agentSessions.id, session.id));
    expect(dbRows.length).toBe(1);
    expect(dbRows[0]?.agentName).toBe("code-optimizer");
    expect(dbRows[0]?.status).toBe("created");

    // 2. Start Session (created -> running)
    const started = await defaultAgentSessionService.startSession(
      session.id,
      ownerContext,
      testWorkspace,
      db
    );
    expect(started.status).toBe("running");
    expect(started.startedAt).not.toBeNull();

    // 3. Pause Session (running -> paused)
    const paused = await defaultAgentSessionService.pauseSession(
      session.id,
      ownerContext,
      testWorkspace,
      db
    );
    expect(paused.status).toBe("paused");

    // 4. Resume Session (paused -> running)
    const resumed = await defaultAgentSessionService.startSession(
      session.id,
      ownerContext,
      testWorkspace,
      db
    );
    expect(resumed.status).toBe("running");

    // 5. Invalid Transition Check (cannot transition running to created)
    expect(defaultAgentSessionService.isValidTransition("running", "created")).toBe(false);

    // 6. Complete Session (running -> completed)
    const completed = await defaultAgentSessionService.completeSession(
      session.id,
      "Successfully updated configurations",
      ownerContext,
      testWorkspace,
      db
    );
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).not.toBeNull();

    // 7. Terminal State Validation (completed cannot transition to running)
    expect(defaultAgentSessionService.isValidTransition("completed", "running")).toBe(false);

    // 8. Workspace Isolation
    const isolatedList = await defaultAgentSessionService.listSessions({}, isolatedWorkspace, db);
    expect(isolatedList.total).toBe(0);

    const testList = await defaultAgentSessionService.listSessions({}, testWorkspace, db);
    expect(testList.total).toBe(1);
    expect(testList.sessions[0]?.id).toBe(session.id);

    // 9. Public Judge Mode Mutation Restriction
    await expect(
      defaultAgentSessionService.createSession(
        {
          workspaceId: testWorkspace,
          agentName: "illegal-judge-agent",
          goal: "Unauthorized mutation"
        },
        judgeContext,
        db
      )
    ).rejects.toThrow(/Public Judge Mode is strictly READ-ONLY/);
  });

  it("Task 4.3 — enforces sandbox boundaries, tool allowlists, and rejects path traversal", async () => {
    const db = getDb();
    const sessionId = `sandbox_test_${Date.now()}`;
    const agentName = "security-auditor";

    // 1. Tool allowlist enforcement
    const illegalToolRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName,
      toolName: "execute_shell_command",
      args: { command: "rm -rf /" },
      db
    });
    expect(illegalToolRes.success).toBe(false);
    expect(illegalToolRes.error).toContain("Tool 'execute_shell_command' is not permitted");

    // 2. Path traversal rejection
    expect(() => {
      defaultAgentSandboxService.resolveSafePath("../../etc/passwd", sessionId);
    }).toThrow(/Path traversal rejected/);

    expect(() => {
      defaultAgentSandboxService.resolveSafePath("/etc/shadow", sessionId);
    }).toThrow(/Path traversal rejected/);

    // 3. Allowed tool: list_files
    const listRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName,
      toolName: "list_files",
      args: { directory: "" },
      db
    });
    expect(listRes.success).toBe(true);
    expect(listRes.output?.files).toBeDefined();

    // 4. Allowed tool: read_file
    const readRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName,
      toolName: "read_file",
      args: { path: "src/config.ts" },
      db
    });
    expect(readRes.success).toBe(true);
    expect(readRes.output?.sha256).toBeDefined();

    // 5. Allowed tool: calculate_file_hash
    const hashRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName,
      toolName: "calculate_file_hash",
      args: { path: "src/config.ts" },
      db
    });
    expect(hashRes.success).toBe(true);
    expect(hashRes.output?.sha256).toBe(readRes.output?.sha256);
  });

  it("Task 4.5 & 4.6 — handles approval gates, prevents duplicate approvals, and ensures denied actions produce no mutations", async () => {
    const db = getDb();
    const session = await defaultAgentSessionService.createSession(
      {
        workspaceId: testWorkspace,
        agentName: "approval-tester",
        goal: "Verify interactive human approval gates"
      },
      ownerContext,
      db
    );
    await defaultAgentSessionService.startSession(session.id, ownerContext, testWorkspace, db);

    const toolCallId = `tc_sec_mod_${Date.now()}`;
    const maliciousPayload = `export const securityPolicy = { zeroTrust: false };\n`;

    // 1. Request Approval for Protected Operation
    const req = await defaultAgentApprovalService.requestApproval(
      {
        sessionId: session.id,
        toolCallId,
        toolName: "modify_file",
        operation: "Disable zero-trust security checks",
        arguments: { path: "src/protected-config.ts", content: maliciousPayload }
      },
      ownerContext,
      testWorkspace,
      db
    );
    expect(req.decision).toBe("pending");

    // Session transitions to awaiting_approval
    const awaitingSession = await defaultAgentSessionService.getSession(
      session.id,
      testWorkspace,
      db
    );
    expect(awaitingSession?.status).toBe("awaiting_approval");

    // 2. Deny Approval
    const denied = await defaultAgentApprovalService.decideApproval(
      {
        approvalId: req.id,
        decision: "rejected",
        reason: "Security violation: zeroTrust disable prohibited"
      },
      ownerContext,
      testWorkspace,
      db
    );
    expect(denied.decision).toBe("rejected");

    // 3. Prevent Duplicate Decision / Replay
    await expect(
      defaultAgentApprovalService.decideApproval(
        {
          approvalId: req.id,
          decision: "approved",
          reason: "Attempted replay"
        },
        ownerContext,
        testWorkspace,
        db
      )
    ).rejects.toThrow(/already been decided/);

    // 4. Denied Action Execution Attempt: MUST FAIL and MUST NOT MODIFY FILE
    const sandboxDir = defaultAgentSandboxService.initSandbox(session.id);
    const protectedFile = `${sandboxDir}/src/protected-config.ts`;
    const initialProtectedBytes = fs.readFileSync(protectedFile, "utf8");

    const execResult = await defaultAgentSandboxService.executeTool({
      sessionId: session.id,
      agentName: "approval-tester",
      toolCallId,
      toolName: "modify_file",
      args: { path: "src/protected-config.ts", content: maliciousPayload },
      approvalId: req.id,
      db
    });

    expect(execResult.success).toBe(false);
    expect(execResult.error).toContain("Authorization denied");

    // Verify file content was completely UNTOUCHED
    const currentProtectedBytes = fs.readFileSync(protectedFile, "utf8");
    expect(currentProtectedBytes).toBe(initialProtectedBytes);
    expect(currentProtectedBytes).not.toContain("zeroTrust: false");
  });

  it("Task 4.8 & 4.15 — executes full deterministic demonstration workflow, verifies event chain, and reconstructs history via replay", async () => {
    const db = getDb();
    const demoResult = await defaultAgentDemoService.runFullDemo(
      {
        workspaceId: testWorkspace,
        agentName: "kiro-demo-agent",
        goal: "Refactor configurations and enforce security compliance"
      },
      ownerContext,
      db
    );

    expect(demoResult.sessionId).toBeDefined();
    expect(demoResult.steps.length).toBe(10);
    expect(demoResult.verification.status).toBe("verified");
    expect(demoResult.totalEvents).toBeGreaterThanOrEqual(10);

    // Retrieve events directly from PostgreSQL
    const streamEvents = await defaultChainService.getEventsFromDb(demoResult.sessionId, db);
    expect(streamEvents.length).toBe(demoResult.totalEvents);

    // Verify cryptographic integrity
    const dbVerify = await defaultChainService.verifyStreamFromDb(demoResult.sessionId, db);
    expect(dbVerify.status).toBe("verified");

    // Reconstruct Replay History (Task 4.8)
    const replaySteps = defaultAgentReplayService.buildReplayHistory(streamEvents);
    expect(replaySteps.length).toBe(streamEvents.length);

    // First step corresponds to session creation
    expect(replaySteps[0]?.currentEvent.event.event_name).toBe("agent.session.created");
    expect(replaySteps[0]?.sessionStatus).toBe("created");

    // Last step corresponds to session completed
    const finalStep = replaySteps[replaySteps.length - 1]!;
    expect(finalStep.currentEvent.event.event_name).toBe("agent.run.completed");
    expect(finalStep.sessionStatus).toBe("completed");
    expect(finalStep.isVerified).toBe(true);

    // Verify file states tracked in replay
    expect(finalStep.files["src/config.ts"]).toBeDefined();
    expect(finalStep.files["src/config.ts"]?.operation).toBe("modify");
    expect(finalStep.files["src/config.ts"]?.newSha256).toBeDefined();
  });
});
