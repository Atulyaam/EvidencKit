import { describe, it, expect, afterAll } from "vitest";
import { getDb, getDbPool } from "../packages/db/src/index";
import {
  defaultAgentSessionService,
  defaultAgentApprovalService,
  defaultAgentSandboxService,
  defaultAgentReplayService,
  defaultAgentDemoService,
  defaultChainService,
  SessionContext
} from "../packages/evidence-server/src/index";
import { createExportBundle, validateImportBundle, EvidenceExportBundle } from "@evidencekit/core";
import fs from "node:fs";
import path from "node:path";

describe("Phase 4 — AgentLedger Complete End-to-End System Journey (Task 4.14)", () => {
  afterAll(async () => {
    try {
      await getDbPool().end();
    } catch {
      // ignore
    }
  });

  const db = getDb();
  const workspaceId = `ws_e2e_al_${Date.now()}`;
  const ownerContext: SessionContext = {
    userId: "lead-secops-auditor",
    role: "owner",
    isOwner: true,
    isJudgeMode: false
  };

  it("executes complete lifecycle: create session, tool calls, approval denial, zero mutation, replay, export, and tamper detection", async () => {
    // 1. Create Session
    const session = await defaultAgentSessionService.createSession(
      {
        workspaceId,
        agentName: "AutonomousSecOptimizer",
        goal: "Safely audit repository dependencies and propose hardening configurations",
        metadata: { model: "claude-3-5-sonnet", environment: "production" }
      },
      ownerContext,
      db
    );

    expect(session.id).toBeDefined();
    expect(session.status).toBe("created");
    const sessionId = session.id;

    // 2. Initialize Sandbox
    const sandboxDir = defaultAgentSandboxService.initSandbox(sessionId);
    expect(fs.existsSync(sandboxDir)).toBe(true);

    // 3. Agent executes safe tool: list_files
    const listRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName: session.agentName,
      toolName: "list_files",
      args: { directory: "." },
      db
    });
    expect(listRes.success).toBe(true);

    // 4. Agent creates a new file: audit_report.txt
    const createRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName: session.agentName,
      toolName: "create_file",
      args: {
        path: "audit_report.txt",
        content: "SECURITY AUDIT: All baseline files verified against compliance checks."
      },
      db
    });
    expect(createRes.success).toBe(true);

    // 5. Agent requests approval to modify protected security policy
    const approval = await defaultAgentApprovalService.requestApproval(
      {
        sessionId,
        toolCallId: "tc_e2e_gate_01",
        toolName: "modify_file",
        operation: "modify",
        arguments: {
          path: "src/protected-config.ts",
          content: "export const securityPolicy = { enforceMfa: false };"
        },
        reason: "Disable MFA for emergency developer access"
      },
      ownerContext,
      workspaceId,
      db
    );

    expect(approval.id).toBeDefined();
    expect(approval.decision).toBe("pending");

    // Session status should now be awaiting_approval
    const sessionAwaiting = await defaultAgentSessionService.getSession(sessionId, workspaceId, db);
    expect(sessionAwaiting?.status).toBe("awaiting_approval");

    // Record original protected file state
    const protectedFilePath = path.join(sandboxDir, "src", "protected-config.ts");
    const origBytes = fs.readFileSync(protectedFilePath, "utf8");
    const origHash = defaultAgentSandboxService.computeFileHash(protectedFilePath);

    // 6. Security Lead DENIES the dangerous request
    const decided = await defaultAgentApprovalService.decideApproval(
      {
        approvalId: approval.id,
        decision: "denied",
        reason: "Strict SOC 2 policy: Disabling MFA in production is strictly rejected."
      },
      ownerContext,
      workspaceId,
      db
    );

    expect(decided.decision).toBe("denied");

    // 7. Verify Zero-Mutation Guarantee: Attempt to execute tool with denied approval
    const deniedToolExec = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName: session.agentName,
      toolCallId: "tc_e2e_gate_01",
      toolName: "modify_file",
      args: {
        path: "src/protected-config.ts",
        content: "export const securityPolicy = { enforceMfa: false };"
      },
      approvalId: approval.id,
      db
    });

    expect(deniedToolExec.success).toBe(false);
    expect(deniedToolExec.error).toMatch(/Authorization denied/i);

    // Ensure protected file was NOT touched
    expect(fs.readFileSync(protectedFilePath, "utf8")).toBe(origBytes);
    expect(defaultAgentSandboxService.computeFileHash(protectedFilePath)).toBe(origHash);

    // 8. Agent executes safe modification on non-protected config
    const safeModRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName: session.agentName,
      toolName: "modify_file",
      args: {
        path: "src/config.ts",
        content: `export const serviceConfig = {\n  timeoutMs: 3000,\n  retries: 5,\n  logLevel: "debug"\n};\n`
      },
      db
    });
    expect(safeModRes.success).toBe(true);

    // 9. Complete the session
    const completedSession = await defaultAgentSessionService.updateSessionStatus(
      sessionId,
      "completed",
      workspaceId,
      db
    );
    expect(completedSession.status).toBe("completed");

    // 10. Verify persisted event stream in PostgreSQL
    const streamEvents = await defaultChainService.getEventsFromDb(sessionId, db);
    expect(streamEvents.length).toBeGreaterThanOrEqual(6);

    // 11. Test Deterministic Replay Reconstruction
    const replaySteps = defaultAgentReplayService.buildReplayHistory(streamEvents);
    expect(replaySteps.length).toBe(streamEvents.length);
    expect(replaySteps[replaySteps.length - 1]?.isVerified).toBe(true);

    // 12. Export EvidenceKit Canonical Bundle
    const exportBundle = createExportBundle(sessionId, "agentledger.session", streamEvents, []);

    expect(exportBundle.manifest.stream_id).toBe(sessionId);
    expect(exportBundle.events.length).toBe(streamEvents.length);
    expect(exportBundle.manifest.chain_head_hash).toBe(
      streamEvents[streamEvents.length - 1]?.event_hash
    );

    // 13. Independently verify the valid exported bundle
    const validVerification = validateImportBundle(exportBundle);
    expect(validVerification.valid).toBe(true);
    expect(validVerification.verification.status).toBe("verified");
    expect(validVerification.verification.total_events).toBe(streamEvents.length);

    // 14. Tamper detection verification: Modify an attribute in the bundle
    const tamperedBundle: EvidenceExportBundle = JSON.parse(JSON.stringify(exportBundle));
    // Tamper with the decision of the approval event
    const apprEv = tamperedBundle.events.find(
      (e) => e.event.event_name === "agent.approval.decided"
    );
    expect(apprEv).toBeDefined();
    if (apprEv) {
      apprEv.event.attributes.decision = "approved"; // Falsified approval!
    }

    const tamperVerification = validateImportBundle(tamperedBundle);
    expect(tamperVerification.valid).toBe(false);
    expect(tamperVerification.verification.status).toBe("failed");
    expect(tamperVerification.verification.error).toBeDefined();
  });

  it("runs the full autonomous demonstration workflow service (demo/run)", async () => {
    const demoResult = await defaultAgentDemoService.runFullDemo(
      {
        workspaceId,
        agentName: "DemoRunnerAgent",
        goal: "Demonstrate complete AI agent auditing and approval workflow"
      },
      ownerContext,
      db
    );

    expect(demoResult.sessionId).toBeDefined();
    expect(demoResult.steps.length).toBe(10);
    expect(demoResult.totalEvents).toBeGreaterThanOrEqual(10);
    expect(demoResult.verification.status).toBe("verified");
    expect(demoResult.headHash).toBeDefined();

    // Verify Step 7 was denied
    const deniedStep = demoResult.steps.find((s) => s.stepIndex === 7);
    expect(deniedStep).toBeDefined();
    expect(deniedStep?.status).toBe("denied");
  });
});
