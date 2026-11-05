import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  defaultChainService,
  defaultExportBundleService
} from "../packages/evidence-server/src/index";
import { EvidenceEvent } from "../packages/evidence-core/src/index";

describe("Phase 3 — TraceVault Scale & Performance Benchmark (Task 3.14)", () => {
  it("benchmarks 1,000 incident events: ingestion, hash-chaining, verification, and timeline query", async () => {
    const streamId = `scale-stream-${Date.now()}`;
    const TOTAL_EVENTS = 1000;

    // 1. Generate 1,000 synthetic incident events
    const generatedEvents: EvidenceEvent[] = [];
    const baseTime = new Date("2026-11-05T00:00:00.000Z").getTime();

    for (let i = 0; i < TOTAL_EVENTS; i++) {
      const occurred = new Date(baseTime + i * 1000).toISOString();
      generatedEvents.push({
        schema_version: "1.0",
        event_id: randomUUID(),
        stream_type: "tracevault.case",
        stream_id: streamId,
        event_name: i % 10 === 0 ? "database.connection.timeout" : "http.request.completed",
        occurred_at: occurred,
        observed_at: occurred,
        time_confidence: "source_timestamp",
        source: {
          system: i % 2 === 0 ? "api-gateway" : "order-service",
          adapter: "benchmark-adapter",
          adapter_version: "1.0.0"
        },
        severity: i % 10 === 0 ? "critical" : "info",
        correlation_ids: [`trace-${Math.floor(i / 5)}`],
        attributes: {
          sequence_index: i,
          latency_ms: Math.floor(Math.random() * 500),
          status_code: i % 10 === 0 ? 504 : 200
        }
      });
    }

    // 2. Benchmark Append Throughput
    const startAppend = performance.now();
    for (const evt of generatedEvents) {
      defaultChainService.appendInMemory(evt);
    }
    const appendDurationMs = performance.now() - startAppend;
    const appendThroughput = (TOTAL_EVENTS / (appendDurationMs / 1000)).toFixed(0);

    // 3. Benchmark Verification Throughput
    const startVerify = performance.now();
    const verifyResult = defaultChainService.verifyInMemory(streamId);
    const verifyDurationMs = performance.now() - startVerify;
    const verifyThroughput = (TOTAL_EVENTS / (verifyDurationMs / 1000)).toFixed(0);

    expect(verifyResult.status).toBe("verified");
    expect(verifyResult.total_events).toBe(TOTAL_EVENTS);

    // 4. Benchmark Filtered Timeline Query (Paginated 50 items)
    const startQuery = performance.now();
    const timelineResult = defaultChainService.queryTimelineInMemory(streamId, {
      severity: "critical",
      limit: 50
    });
    const queryDurationMs = performance.now() - startQuery;

    expect(timelineResult.events.length).toBe(50);
    expect(timelineResult.total).toBe(100); // 1,000 / 10

    // 5. Benchmark Export Bundle Generation
    const startExport = performance.now();
    const exportBundle = await defaultExportBundleService.exportBundleJson(streamId);
    const exportDurationMs = performance.now() - startExport;

    expect(exportBundle.manifest.event_count).toBe(TOTAL_EVENTS);
    expect(exportBundle.verification_report.status).toBe("verified");

    // Output Scale Benchmark Summary
    console.log(`\n========================================================`);
    console.log(`TRACEVAULT SCALE & PERFORMANCE BENCHMARK (1,000 EVENTS)`);
    console.log(`========================================================`);
    console.log(
      `- Ingest & Append Time:   ${appendDurationMs.toFixed(2)} ms (${appendThroughput} events/sec)`
    );
    console.log(
      `- Full Chain Verify Time: ${verifyDurationMs.toFixed(2)} ms (${verifyThroughput} events/sec)`
    );
    console.log(`- Filtered Timeline Query:${queryDurationMs.toFixed(2)} ms`);
    console.log(`- Full Bundle Export:     ${exportDurationMs.toFixed(2)} ms`);
    console.log(`========================================================\n`);

    // Latency Assertions
    expect(appendDurationMs).toBeLessThan(1000); // Ingest 1,000 events in < 1 second
    expect(verifyDurationMs).toBeLessThan(150); // Verify 1,000 hashes in < 150 ms
    expect(queryDurationMs).toBeLessThan(20); // Query timeline in < 20 ms
  });
});
