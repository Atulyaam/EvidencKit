import { describe, it } from "vitest";
import fc from "fast-check";
import {
  computeEventHash,
  verifyEventChain,
  INITIAL_PREVIOUS_HASH,
  ChainedEvent,
  EvidenceEvent
} from "@evidencekit/core";
import { defaultAgentReplayService } from "../packages/evidence-server/src/index";

describe("Phase 4 — AgentLedger Property-Based Invariant Tests (fast-check)", () => {
  it("property: arbitrary agent event sequences always produce valid hash chains", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            toolName: fc.constantFrom("list_files", "read_file", "create_file", "modify_file"),
            agentId: fc.string({ minLength: 2, maxLength: 20 }),
            status: fc.constantFrom("started", "completed", "failed"),
            durationMs: fc.integer({ min: 1, max: 10000 })
          }),
          { minLength: 1, maxLength: 30 }
        ),
        (toolRuns) => {
          const streamId = "prop-stream-al";
          const chain: ChainedEvent[] = [];
          let previousHash = INITIAL_PREVIOUS_HASH;

          for (let i = 0; i < toolRuns.length; i++) {
            const run = toolRuns[i]!;
            const ev: EvidenceEvent = {
              schema_version: "1.0",
              event_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
              stream_type: "agentledger.session",
              stream_id: streamId,
              event_name: `agent.tool.${run.status}`,
              occurred_at: new Date(1700000000000 + i * 1000).toISOString(),
              observed_at: new Date(1700000000000 + i * 1000).toISOString(),
              time_confidence: "source_timestamp",
              source: { system: "agent-runtime", adapter: "agent-sdk", adapter_version: "1.0.0" },
              actor: { type: "agent", id: run.agentId },
              severity: run.status === "failed" ? "warning" : "info",
              correlation_ids: [`tc_${i}`],
              attributes: {
                tool_call_id: `tc_${i}`,
                tool_name: run.toolName,
                duration_ms: run.durationMs
              }
            };

            const eventHash = computeEventHash(ev, previousHash);
            chain.push({
              event: ev,
              stream_sequence: i,
              previous_hash: previousHash,
              event_hash: eventHash
            });
            previousHash = eventHash;
          }

          const verification = verifyEventChain(chain);
          return (
            verification.status === "verified" && verification.total_events === toolRuns.length
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it("property: tampering any byte in an arbitrary agent chain triggers verification failure", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 15 }),
        fc.integer({ min: 0, max: 14 }),
        (goals, tamperIndexSeed) => {
          const streamId = "prop-stream-tamper";
          const chain: ChainedEvent[] = [];
          let previousHash = INITIAL_PREVIOUS_HASH;

          for (let i = 0; i < goals.length; i++) {
            const ev: EvidenceEvent = {
              schema_version: "1.0",
              event_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
              stream_type: "agentledger.session",
              stream_id: streamId,
              event_name: "agent.session.created",
              occurred_at: new Date(1700000000000 + i * 1000).toISOString(),
              observed_at: new Date(1700000000000 + i * 1000).toISOString(),
              time_confidence: "source_timestamp",
              source: { system: "agent-runtime", adapter: "agent-sdk", adapter_version: "1.0.0" },
              actor: { type: "agent", id: "agent-tamper-tester" },
              severity: "info",
              attributes: { goal: goals[i] }
            };

            const eventHash = computeEventHash(ev, previousHash);
            chain.push({
              event: ev,
              stream_sequence: i,
              previous_hash: previousHash,
              event_hash: eventHash
            });
            previousHash = eventHash;
          }

          // Pick an index to tamper
          const tamperIndex = tamperIndexSeed % chain.length;
          const clonedChain: ChainedEvent[] = JSON.parse(JSON.stringify(chain));
          // Mutate the attribute
          clonedChain[tamperIndex]!.event.attributes.goal = "TAMPERED_GOAL_VALUE";

          const verification = verifyEventChain(clonedChain);
          return verification.status === "failed";
        }
      ),
      { numRuns: 50 }
    );
  });

  it("property: deterministic replay history preserves exact step count and sequence monotonicity", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 25 }), (stepCount) => {
        const streamId = `prop-stream-replay-${stepCount}`;
        const chain: ChainedEvent[] = [];
        let previousHash = INITIAL_PREVIOUS_HASH;

        for (let i = 0; i < stepCount; i++) {
          const ev: EvidenceEvent = {
            schema_version: "1.0",
            event_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
            stream_type: "agentledger.session",
            stream_id: streamId,
            event_name: i === 0 ? "agent.session.created" : "agent.tool.completed",
            occurred_at: new Date(1700000000000 + i * 1000).toISOString(),
            observed_at: new Date(1700000000000 + i * 1000).toISOString(),
            time_confidence: "source_timestamp",
            source: { system: "agent-runtime", adapter: "agent-sdk", adapter_version: "1.0.0" },
            actor: { type: "agent", id: "agent-step" },
            severity: "info",
            correlation_ids: [`tc_${i}`],
            attributes: {
              tool_call_id: `tc_${i}`,
              tool_name: "list_files",
              output: { count: i }
            }
          };

          const eventHash = computeEventHash(ev, previousHash);
          chain.push({
            event: ev,
            stream_sequence: i,
            previous_hash: previousHash,
            event_hash: eventHash
          });
          previousHash = eventHash;
        }

        const replaySteps = defaultAgentReplayService.buildReplayHistory(chain);

        // Invariant 1: Exactly matches step count
        if (replaySteps.length !== stepCount) return false;

        // Invariant 2: Step indices and stream sequences are strictly monotonic
        for (let s = 0; s < replaySteps.length; s++) {
          if (replaySteps[s]!.stepIndex !== s + 1) return false;
          if (replaySteps[s]!.currentEvent.stream_sequence !== s) return false;
        }

        return true;
      }),
      { numRuns: 30 }
    );
  });
});
