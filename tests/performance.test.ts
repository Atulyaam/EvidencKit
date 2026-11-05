import { describe, it, expect } from "vitest";
import {
  EvidenceEvent,
  computeEventHash,
  verifyEventChain,
  INITIAL_PREVIOUS_HASH,
  ChainedEvent,
  queryTimeline
} from "@evidencekit/core";

describe("Phase 2 — Performance Benchmarks (1,000+ Event Stream)", () => {
  it("benchmarks 1,000 event hash-chain generation, verification, and timeline queries", () => {
    const totalEvents = 1000;
    const streamId = "benchmark-case-1000";

    // 1. Generation Benchmark
    const startGen = performance.now();
    const chainedEvents: ChainedEvent[] = [];
    let prev = INITIAL_PREVIOUS_HASH;

    for (let i = 0; i < totalEvents; i++) {
      const ev: EvidenceEvent = {
        schema_version: "1.0",
        event_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        stream_type: "tracevault.case",
        stream_id: streamId,
        event_name: i % 10 === 0 ? "deployment.failed" : "app.log.info",
        occurred_at: new Date(1700000000000 + i * 500).toISOString(),
        observed_at: new Date(1700000000000 + i * 500 + 200).toISOString(),
        time_confidence: "source_timestamp",
        source: {
          system: "benchmark-runner",
          adapter: "benchmark-adapter",
          adapter_version: "1.0.0"
        },
        severity: i % 10 === 0 ? "error" : "info",
        attributes: {
          step: i,
          payload: `Benchmark payload ${i}`
        },
        evidence_refs: []
      };

      const hash = computeEventHash(ev, prev);
      chainedEvents.push({
        event: ev,
        stream_sequence: i,
        previous_hash: prev,
        event_hash: hash
      });
      prev = hash;
    }
    const endGen = performance.now();
    const genDurationMs = endGen - startGen;

    expect(chainedEvents.length).toBe(totalEvents);
    // 1,000 SHA-256 hashes + JCS should complete well under 2,000ms
    expect(genDurationMs).toBeLessThan(2000);

    // 2. Chain Verification Benchmark
    const startVerify = performance.now();
    const verification = verifyEventChain(chainedEvents);
    const endVerify = performance.now();
    const verifyDurationMs = endVerify - startVerify;

    expect(verification.status).toBe("verified");
    expect(verification.total_events).toBe(totalEvents);
    expect(verifyDurationMs).toBeLessThan(2000);

    // 3. Paginated Timeline Query Benchmark
    const startQuery = performance.now();
    const timelineResult = queryTimeline(chainedEvents, {
      severity: "error",
      limit: 50,
      offset: 0
    });
    const endQuery = performance.now();
    const queryDurationMs = endQuery - startQuery;

    expect(timelineResult.total).toBe(100);
    expect(timelineResult.events.length).toBe(50);
    expect(queryDurationMs).toBeLessThan(50);

    console.log(`[PERFORMANCE BENCHMARK RESULTS]
- 1,000 Events Chained: ${genDurationMs.toFixed(2)} ms (${(1000 / (genDurationMs / 1000)).toFixed(0)} events/sec)
- 1,000 Events Verified: ${verifyDurationMs.toFixed(2)} ms (${(1000 / (verifyDurationMs / 1000)).toFixed(0)} events/sec)
- Paginated Timeline Query (50 items): ${queryDurationMs.toFixed(2)} ms`);
  });
});
