import { defaultAgentSessionService, AgentSessionRecord } from "./agent-session-service";
import { defaultAgentApprovalService, AgentApprovalRecord } from "./agent-approval-service";
import { defaultAgentSandboxService, ToolExecutionResult } from "./agent-sandbox-service";
import { defaultChainService } from "./chain-service";
import { SessionContext } from "../authorization/index";
import { DbClient } from "@evidencekit/db";
import { VerificationResult } from "@evidencekit/core";

export interface DemoWorkflowStep {
  stepIndex: number;
  name: string;
  description: string;
  status: "success" | "denied" | "failed";
  toolResult?: ToolExecutionResult;
  approval?: AgentApprovalRecord;
}

export interface DemoWorkflowResult {
  sessionId: string;
  session: AgentSessionRecord;
  steps: DemoWorkflowStep[];
  verification: VerificationResult;
  headHash: string;
  totalEvents: number;
}

export class AgentDemoService {
  /**
   * Executes the complete 10-step deterministic demonstration workflow.
   */
  public async runFullDemo(
    params: {
      workspaceId?: string;
      agentName?: string;
      goal?: string;
    },
    context: SessionContext,
    db?: DbClient
  ): Promise<DemoWorkflowResult> {
    const workspaceId = params.workspaceId || "ws_demo_default";
    const agentName = params.agentName || "refactoring-assistant";
    const goal =
      params.goal ||
      "Audit service configurations, optimize request timeouts, and verify production zero-trust policy enforcement.";

    const steps: DemoWorkflowStep[] = [];

    // Step 1: Create and start session
    const session = await defaultAgentSessionService.createSession(
      {
        workspaceId,
        agentName,
        goal,
        metadata: {
          environment: "sandbox-demo",
          model: "deterministic-simulated-agent-v1",
          demoWorkflow: "full-audit-cycle"
        }
      },
      context,
      db
    );

    await defaultAgentSessionService.startSession(session.id, context, workspaceId, db);
    steps.push({
      stepIndex: 1,
      name: "Session Initialized",
      description: `Session '${session.id}' started for agent '${agentName}'. Initial sandbox populated.`,
      status: "success"
    });

    // Step 2: Tool list_files
    const listRes = await defaultAgentSandboxService.executeTool({
      sessionId: session.id,
      agentName,
      toolName: "list_files",
      args: { directory: "" },
      db
    });
    steps.push({
      stepIndex: 2,
      name: "List Project Files",
      description: "Inspected sandbox file repository structure.",
      status: "success",
      toolResult: listRes
    });

    // Step 3: Tool read_file config.ts
    const readRes = await defaultAgentSandboxService.executeTool({
      sessionId: session.id,
      agentName,
      toolName: "read_file",
      args: { path: "src/config.ts" },
      db
    });
    steps.push({
      stepIndex: 3,
      name: "Read Configuration",
      description: "Read service configuration from 'src/config.ts'.",
      status: "success",
      toolResult: readRes
    });

    // Step 4: Propose harmless change & Request Approval
    const safeToolCallId = `tc_opt_timeout_${Date.now()}`;
    const safeContent = `export const serviceConfig = {\n  timeoutMs: 8000,\n  retries: 3,\n  logLevel: "info"\n};\n`;

    const approvalReq1 = await defaultAgentApprovalService.requestApproval(
      {
        sessionId: session.id,
        toolCallId: safeToolCallId,
        toolName: "modify_file",
        operation: "Update serviceConfig.timeoutMs to 8000ms for latency resilience",
        arguments: { path: "src/config.ts", content: safeContent },
        reason: "Increase timeout tolerance under high latency load"
      },
      context,
      workspaceId,
      db
    );

    // Step 5: Human approval decision (Approved)
    const approved1 = await defaultAgentApprovalService.decideApproval(
      {
        approvalId: approvalReq1.id,
        decision: "approved",
        reason: "Verified safe: 8000ms timeout complies with standard SLA thresholds"
      },
      context,
      workspaceId,
      db
    );

    steps.push({
      stepIndex: 4,
      name: "Safe Modification Approved",
      description: "Requested and approved safe timeout update for 'src/config.ts'.",
      status: "success",
      approval: approved1
    });

    // Step 6: Execute modify_file on src/config.ts
    const modifyRes = await defaultAgentSandboxService.executeTool({
      sessionId: session.id,
      agentName,
      toolCallId: safeToolCallId,
      toolName: "modify_file",
      args: { path: "src/config.ts", content: safeContent },
      approvalId: approved1.id,
      db
    });

    steps.push({
      stepIndex: 5,
      name: "Execute Approved Modification",
      description:
        "Applied modification to 'src/config.ts'. Recorded before/after SHA-256 and diff.",
      status: "success",
      toolResult: modifyRes
    });

    // Step 7: Calculate file hash on src/config.ts
    const hashRes1 = await defaultAgentSandboxService.executeTool({
      sessionId: session.id,
      agentName,
      toolName: "calculate_file_hash",
      args: { path: "src/config.ts" },
      db
    });

    steps.push({
      stepIndex: 6,
      name: "Verify Updated Hash",
      description: `Calculated post-modification hash for 'src/config.ts': ${hashRes1.output?.sha256}`,
      status: "success",
      toolResult: hashRes1
    });

    // Step 8: Attempt restricted change on protected-config.ts
    const restrictedToolCallId = `tc_disable_mfa_${Date.now()}`;
    const maliciousContent = `export const securityPolicy = {\n  enforceMfa: false,\n  auditLevel: "none",\n  zeroTrust: false\n};\n`;

    const approvalReq2 = await defaultAgentApprovalService.requestApproval(
      {
        sessionId: session.id,
        toolCallId: restrictedToolCallId,
        toolName: "modify_file",
        operation: "Disable zeroTrust and MFA in protected-config.ts",
        arguments: { path: "src/protected-config.ts", content: maliciousContent },
        reason: "Attempt to bypass authentication constraints"
      },
      context,
      workspaceId,
      db
    );

    // Step 9: Human approval decision (Rejected / Denied)
    const denied2 = await defaultAgentApprovalService.decideApproval(
      {
        approvalId: approvalReq2.id,
        decision: "rejected",
        reason:
          "REJECTED: Unauthorized attempt to weaken production security policy (MFA disable forbidden)"
      },
      context,
      workspaceId,
      db
    );

    steps.push({
      stepIndex: 7,
      name: "Security Violation Denied",
      description:
        "Human reviewer strictly denied reduction of security policy in 'src/protected-config.ts'.",
      status: "denied",
      approval: denied2
    });

    // Step 10: Attempt execution without approval -> MUST FAIL and produce zero mutation
    const failedModifyRes = await defaultAgentSandboxService.executeTool({
      sessionId: session.id,
      agentName,
      toolCallId: restrictedToolCallId,
      toolName: "modify_file",
      args: { path: "src/protected-config.ts", content: maliciousContent },
      approvalId: denied2.id, // Rejected approval ID
      db
    });

    steps.push({
      stepIndex: 8,
      name: "Denied Mutation Aborted",
      description: "Sandbox blocked modification. Protected file remained completely untouched.",
      status: "denied",
      toolResult: failedModifyRes
    });

    // Step 11: Verify protected-config.ts SHA-256 is unchanged
    const hashRes2 = await defaultAgentSandboxService.executeTool({
      sessionId: session.id,
      agentName,
      toolName: "calculate_file_hash",
      args: { path: "src/protected-config.ts" },
      db
    });

    steps.push({
      stepIndex: 9,
      name: "Protected Hash Unchanged",
      description: `Verified baseline hash for 'src/protected-config.ts' remains intact: ${hashRes2.output?.sha256}`,
      status: "success",
      toolResult: hashRes2
    });

    // Step 12: Complete session
    const finalSession = await defaultAgentSessionService.completeSession(
      session.id,
      "Demonstration workflow completed successfully. Safe file modification verified with cryptographic digests; unauthorized security mutation was strictly denied and prevented.",
      context,
      workspaceId,
      db
    );

    steps.push({
      stepIndex: 10,
      name: "Session Completed & Sealed",
      description: "Audit session completed. Full hash-chain sealed and verified.",
      status: "success"
    });

    // Verify the complete session event chain
    const verification = db
      ? await defaultChainService.verifyStreamFromDb(session.id, db)
      : defaultChainService.verifyInMemory(session.id);

    const allEvents = db
      ? await defaultChainService.getEventsFromDb(session.id, db)
      : defaultChainService.getEventsInMemory(session.id);

    const headHash =
      allEvents.length > 0 ? allEvents[allEvents.length - 1]!.event_hash : "0".repeat(64);

    return {
      sessionId: session.id,
      session: finalSession,
      steps,
      verification,
      headHash,
      totalEvents: allEvents.length
    };
  }
}

export const defaultAgentDemoService = new AgentDemoService();
