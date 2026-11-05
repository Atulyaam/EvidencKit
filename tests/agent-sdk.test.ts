import { describe, it, expect } from "vitest";
import { AgentSessionRecorder } from "@evidencekit/agent-sdk";
import { defaultChainService } from "@evidencekit/evidence-server";

describe("Phase 2 — Agent SDK & Instrumented Audit Trail", () => {
  const sessionId = "session_agent_test_01";
  const agentName = "audit-bot-v1";

  it("records a full instrumented agent workflow and verifies chain integrity", () => {
    const recorder = new AgentSessionRecorder(sessionId, agentName);

    // 1. Session created
    const e1 = recorder.recordSessionCreated("Automated security configuration audit");
    const c1 = defaultChainService.appendInMemory(e1);
    expect(c1.stream_sequence).toBe(0);

    // 2. Tool started
    const toolCallId = "call-101";
    const e2 = recorder.recordToolStarted({
      toolCallId,
      toolName: "modify_config",
      arguments: { file: "config.json", mode: "strict" },
      requiresApproval: true
    });
    const c2 = defaultChainService.appendInMemory(e2);
    expect(c2.stream_sequence).toBe(1);

    // 3. Approval requested
    const e3 = recorder.recordApprovalRequested({
      toolCallId,
      toolName: "modify_config",
      arguments: { file: "config.json" }
    });
    const c3 = defaultChainService.appendInMemory(e3);
    expect(c3.stream_sequence).toBe(2);

    // 4. Approval decided
    const e4 = recorder.recordApprovalDecided({
      toolCallId,
      decision: "approved",
      actorId: "lead-security-reviewer",
      reason: "Conforms to policy"
    });
    const c4 = defaultChainService.appendInMemory(e4);
    expect(c4.stream_sequence).toBe(3);

    // 5. File changed
    const e5 = recorder.recordFileChanged(toolCallId, {
      path: "config.json",
      oldSha256: "0".repeat(64),
      newSha256: "a".repeat(64),
      diffSummary: "+ { strict: true }"
    });
    const c5 = defaultChainService.appendInMemory(e5);
    expect(c5.stream_sequence).toBe(4);

    // 6. Tool completed
    const e6 = recorder.recordToolCompleted(toolCallId, { success: true });
    const c6 = defaultChainService.appendInMemory(e6);
    expect(c6.stream_sequence).toBe(5);

    // 7. Run completed
    const e7 = recorder.recordRunCompleted("Security configuration audit completed successfully");
    const c7 = defaultChainService.appendInMemory(e7);
    expect(c7.stream_sequence).toBe(6);

    // Verify complete chain
    const verification = defaultChainService.verifyInMemory(sessionId);
    expect(verification.status).toBe("verified");
    expect(verification.total_events).toBe(7);
    expect(verification.head_hash).toBe(c7.event_hash);
  });
});
