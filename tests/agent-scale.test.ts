import { describe, it, expect } from "vitest";
import {
  defaultAgentSandboxService,
  defaultAgentReplayService,
  defaultChainService
} from "../packages/evidence-server/src/index";
import { verifyEventChain, ChainedEvent, EvidenceEvent } from "@evidencekit/core";
import { randomUUID } from "node:crypto";

describe("Phase 4 — AgentLedger Scale & Performance Benchmark Suite", () => {
  const sessionId = `scale_bench_${Date.now()}`;

  it("executes 100 sequential tool calls in sandbox and verifies hash chain integrity", async () => {
    defaultAgentSandboxService.initSandbox(sessionId);

    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      const fileName = `scale_file_${i}.txt`;
      const createRes = await defaultAgentSandboxService.executeTool({
        sessionId,
        agentName: "scale-worker",
        toolName: "create_file",
        args: {
          path: fileName,
          content: `Iteration ${i}: Content for scale testing ${Date.now()}`
        }
      });
      expect(createRes.success).toBe(true);

      const hashRes = await defaultAgentSandboxService.executeTool({
        sessionId,
        agentName: "scale-worker",
        toolName: "calculate_file_hash",
        args: { path: fileName }
      });
      expect(hashRes.success).toBe(true);
    }

    const elapsed = Date.now() - startTime;
    // 200 total tool executions (100 creates + 100 hashes)
    expect(elapsed).toBeLessThan(15000); // Well under 15s for 200 fs operations

    // Retrieve stream events from in-memory chain service
    const events = defaultChainService.getEventsInMemory(sessionId);
    expect(events.length).toBeGreaterThanOrEqual(200);

    // Cryptographic hash chain verification
    const verification = defaultChainService.verifyInMemory(sessionId);
    expect(verification.status).toBe("verified");
    expect(verification.total_events).toBe(events.length);
  }, 20000);

  it("benchmarks deterministic replay reconstruction performance on large event logs (>100 steps)", async () => {
    const replaySessionId = `replay_perf_${Date.now()}`;
    const syntheticEvents: ChainedEvent[] = [];

    // Construct 250 synthetic chained agent events
    for (let i = 0; i < 250; i++) {
      const ev: EvidenceEvent = {
        schema_version: "1.0",
        event_id: randomUUID(),
        stream_type: "agentledger.session",
        stream_id: replaySessionId,
        event_name: i % 2 === 0 ? "agent.tool.started" : "agent.tool.completed",
        occurred_at: new Date(Date.now() + i * 100).toISOString(),
        observed_at: new Date(Date.now() + i * 100).toISOString(),
        time_confidence: "source_timestamp",
        source: { system: "agent-runtime", adapter: "agent-sdk", adapter_version: "1.0.0" },
        actor: { type: "agent", id: "perf-bot" },
        severity: "info",
        correlation_ids: [`tc_${Math.floor(i / 2)}`],
        attributes: {
          tool_call_id: `tc_${Math.floor(i / 2)}`,
          tool_name: "read_file",
          step: i
        }
      };

      const chained = defaultChainService.appendInMemory(ev);
      syntheticEvents.push(chained);
    }

    // Benchmark replay reconstruction
    const t0 = performance.now();
    const replaySteps = defaultAgentReplayService.buildReplayHistory(syntheticEvents);
    const t1 = performance.now();

    const reconstructionTimeMs = t1 - t0;
    expect(replaySteps.length).toBe(250);
    expect(replaySteps[249]?.isVerified).toBe(true);

    // Deterministic replay over 250 events should be fast (< 500ms, > 500 steps/sec)
    expect(reconstructionTimeMs).toBeLessThan(500);
  });

  it("verifies hash-chain scale invariance across 1,000 chained events", () => {
    const chainSessionId = `chain_1k_${Date.now()}`;
    const chainedList: ChainedEvent[] = [];

    for (let i = 0; i < 1000; i++) {
      const ev: EvidenceEvent = {
        schema_version: "1.0",
        event_id: randomUUID(),
        stream_type: "agentledger.session",
        stream_id: chainSessionId,
        event_name: "agent.tool.completed",
        occurred_at: new Date().toISOString(),
        observed_at: new Date().toISOString(),
        time_confidence: "source_timestamp",
        source: { system: "agent-runtime", adapter: "agent-sdk", adapter_version: "1.0.0" },
        actor: { type: "agent", id: "bulk-runner" },
        severity: "info",
        correlation_ids: [`seq_${i}`],
        attributes: { sequence: i, payload: `Payload data chunk ${i}` }
      };

      const chained = defaultChainService.appendInMemory(ev);
      chainedList.push(chained);
    }

    expect(chainedList.length).toBe(1000);

    const t0 = performance.now();
    const result = verifyEventChain(chainedList);
    const verifyTimeMs = performance.now() - t0;

    expect(result.status).toBe("verified");
    expect(result.total_events).toBe(1000);
    expect(result.first_sequence).toBe(0);
    expect(result.last_sequence).toBe(999);
    // 1,000 SHA-256 canonical chain validations in < 500ms
    expect(verifyTimeMs).toBeLessThan(500);
  });
});
