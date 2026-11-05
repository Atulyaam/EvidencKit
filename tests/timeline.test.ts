import { describe, it, expect } from "vitest";
import {
  ChainedEvent,
  sortEventsForTimeline,
  queryTimeline,
  EvidenceEvent
} from "@evidencekit/core";

function makeChainedEvent(
  id: string,
  seq: number,
  occurredAt: string | null,
  severity: "info" | "warning" | "error" = "info",
  system = "system-a",
  eventName = "test.event"
): ChainedEvent {
  const event: EvidenceEvent = {
    schema_version: "1.0",
    event_id: id,
    stream_type: "tracevault.case",
    stream_id: "stream-timeline-test",
    event_name: eventName,
    occurred_at: occurredAt,
    observed_at: "2026-11-16T12:00:00.000Z",
    time_confidence: occurredAt ? "source_timestamp" : "ingestion_fallback",
    source: {
      system,
      adapter: "test-adapter",
      adapter_version: "1.0.0"
    },
    severity,
    attributes: {},
    evidence_refs: []
  };

  return {
    event,
    stream_sequence: seq,
    previous_hash: "0".repeat(64),
    event_hash: "1".repeat(64)
  };
}

describe("Phase 2 — Timeline Engine (Dual-Ordering & Query)", () => {
  it("sorts events by occurred_at ASC", () => {
    const e1 = makeChainedEvent(
      "11111111-1111-1111-1111-111111111111",
      0,
      "2026-11-16T10:30:00.000Z"
    );
    const e2 = makeChainedEvent(
      "22222222-2222-2222-2222-222222222222",
      1,
      "2026-11-16T10:15:00.000Z"
    ); // earlier!
    const e3 = makeChainedEvent(
      "33333333-3333-3333-3333-333333333333",
      2,
      "2026-11-16T10:45:00.000Z"
    );

    const sorted = sortEventsForTimeline([e1, e2, e3]);

    expect(sorted[0]!.event.event_id).toBe(e2.event.event_id);
    expect(sorted[1]!.event.event_id).toBe(e1.event.event_id);
    expect(sorted[2]!.event.event_id).toBe(e3.event.event_id);
  });

  it("tie-breaks equal occurred_at using stream_sequence", () => {
    const e1 = makeChainedEvent(
      "11111111-1111-1111-1111-111111111111",
      0,
      "2026-11-16T10:00:00.000Z"
    );
    const e2 = makeChainedEvent(
      "22222222-2222-2222-2222-222222222222",
      1,
      "2026-11-16T10:00:00.000Z"
    );

    const sorted = sortEventsForTimeline([e2, e1]);

    expect(sorted[0]!.stream_sequence).toBe(0);
    expect(sorted[1]!.stream_sequence).toBe(1);
  });

  it("places null occurred_at events at the end sorted by stream_sequence", () => {
    const e1 = makeChainedEvent("11111111-1111-1111-1111-111111111111", 0, null);
    const e2 = makeChainedEvent(
      "22222222-2222-2222-2222-222222222222",
      1,
      "2026-11-16T09:00:00.000Z"
    );
    const e3 = makeChainedEvent("33333333-3333-3333-3333-333333333333", 2, null);

    const sorted = sortEventsForTimeline([e1, e2, e3]);

    expect(sorted[0]!.event.event_id).toBe(e2.event.event_id);
    expect(sorted[1]!.stream_sequence).toBe(0);
    expect(sorted[2]!.stream_sequence).toBe(2);
  });

  it("correctly filters by severity and paginates results", () => {
    const items = [
      makeChainedEvent("1", 0, "2026-11-16T10:01:00.000Z", "info"),
      makeChainedEvent("2", 1, "2026-11-16T10:02:00.000Z", "error"),
      makeChainedEvent("3", 2, "2026-11-16T10:03:00.000Z", "error"),
      makeChainedEvent("4", 3, "2026-11-16T10:04:00.000Z", "warning"),
      makeChainedEvent("5", 4, "2026-11-16T10:05:00.000Z", "error")
    ];

    const result = queryTimeline(items, { severity: "error", limit: 2, offset: 0 });

    expect(result.total).toBe(3);
    expect(result.events.length).toBe(2);
    expect(result.hasMore).toBe(true);
    expect(result.events.every((e) => e.event.severity === "error")).toBe(true);

    const page2 = queryTimeline(items, { severity: "error", limit: 2, offset: 2 });
    expect(page2.events.length).toBe(1);
    expect(page2.hasMore).toBe(false);
  });

  it("filters events using text search across event names and attributes", () => {
    const items = [
      makeChainedEvent("1", 0, "2026-11-16T10:01:00.000Z", "info", "system-a", "git.push"),
      makeChainedEvent("2", 1, "2026-11-16T10:02:00.000Z", "error", "system-b", "ci.job.failed"),
      makeChainedEvent(
        "3",
        2,
        "2026-11-16T10:03:00.000Z",
        "info",
        "system-c",
        "deployment.completed"
      )
    ];

    const searchResult = queryTimeline(items, { search: "ci.job" });
    expect(searchResult.total).toBe(1);
    expect(searchResult.events[0]!.event.event_name).toBe("ci.job.failed");
  });
});
