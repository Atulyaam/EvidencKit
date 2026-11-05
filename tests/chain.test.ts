import { describe, it, expect } from "vitest";
import {
  EvidenceEvent,
  computeEventHash,
  verifyEventChain,
  INITIAL_PREVIOUS_HASH,
  ChainedEvent
} from "@evidencekit/core";

function makeSampleEvent(
  streamId: string,
  eventId: string,
  eventName: string,
  seq: number
): EvidenceEvent {
  return {
    schema_version: "1.0",
    event_id: eventId,
    stream_type: "tracevault.case",
    stream_id: streamId,
    event_name: eventName,
    occurred_at: `2026-11-16T10:0${seq}:00.000Z`,
    observed_at: `2026-11-16T10:0${seq}:05.000Z`,
    time_confidence: "source_timestamp",
    source: {
      system: "test-system",
      adapter: "test-adapter",
      adapter_version: "1.0.0"
    },
    severity: "info",
    attributes: { index: seq, payload: `sample-${seq}` },
    evidence_refs: []
  };
}

describe("Phase 2 — SHA-256 Hash Chain & Verification Engine", () => {
  const streamId = "case_chain_test_01";
  const rawEvents: EvidenceEvent[] = [
    makeSampleEvent(streamId, "11111111-1111-4111-8111-111111111111", "git.push", 0),
    makeSampleEvent(streamId, "22222222-2222-4222-8222-222222222222", "ci.job.started", 1),
    makeSampleEvent(streamId, "33333333-3333-4333-8333-333333333333", "deployment.completed", 2)
  ];

  function buildValidChain(events: EvidenceEvent[]): ChainedEvent[] {
    const chain: ChainedEvent[] = [];
    let prev = INITIAL_PREVIOUS_HASH;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      const hash = computeEventHash(ev, prev);
      chain.push({
        event: ev,
        stream_sequence: i,
        previous_hash: prev,
        event_hash: hash
      });
      prev = hash;
    }
    return chain;
  }

  it("builds a valid hash chain with initial 32 zero bytes", () => {
    const chain = buildValidChain(rawEvents);
    expect(chain[0]!.previous_hash).toBe("0".repeat(64));
    expect(chain[0]!.event_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(chain[1]!.previous_hash).toBe(chain[0]!.event_hash);
    expect(chain[2]!.previous_hash).toBe(chain[1]!.event_hash);

    const report = verifyEventChain(chain);
    expect(report.status).toBe("verified");
    expect(report.total_events).toBe(3);
    expect(report.head_hash).toBe(chain[2]!.event_hash);
  });

  it("detects tampered event payload (modified attributes)", () => {
    const chain = buildValidChain(rawEvents);
    // Tamper event 1 attributes
    const tampered = JSON.parse(JSON.stringify(chain)) as ChainedEvent[];
    tampered[1]!.event.attributes["tampered"] = true;

    const report = verifyEventChain(tampered);
    expect(report.status).toBe("failed");
    expect(report.failed_at_sequence).toBe(1);
    expect(report.error).toContain("Event hash mismatch");
  });

  it("detects deleted event (gap in sequence)", () => {
    const chain = buildValidChain(rawEvents);
    // Remove sequence 1
    const tampered = [chain[0]!, chain[2]!];

    const report = verifyEventChain(tampered);
    expect(report.status).toBe("failed");
    expect(report.error).toContain("discontinuity");
  });

  it("detects reordered events", () => {
    const chain = buildValidChain(rawEvents);
    // Swap 1 and 2
    const tampered = [chain[0]!, chain[2]!, chain[1]!];

    const report = verifyEventChain(tampered);
    expect(report.status).toBe("failed");
  });

  it("detects inserted fake event", () => {
    const chain = buildValidChain(rawEvents);
    const fakeEvent = makeSampleEvent(
      streamId,
      "44444444-4444-4444-8444-444444444444",
      "fake.event",
      99
    );
    const fakeChained: ChainedEvent = {
      event: fakeEvent,
      stream_sequence: 1,
      previous_hash: chain[0]!.event_hash,
      event_hash: computeEventHash(fakeEvent, chain[0]!.event_hash)
    };
    const tampered = [chain[0]!, fakeChained, chain[1]!, chain[2]!];

    const report = verifyEventChain(tampered);
    expect(report.status).toBe("failed");
  });

  it("detects modified previous_hash pointer", () => {
    const chain = buildValidChain(rawEvents);
    const tampered = JSON.parse(JSON.stringify(chain)) as ChainedEvent[];
    tampered[1]!.previous_hash = "a".repeat(64);

    const report = verifyEventChain(tampered);
    expect(report.status).toBe("failed");
    expect(report.failed_at_sequence).toBe(1);
    expect(report.error).toContain("Previous hash mismatch");
  });

  it("detects mismatched expected chain head hash", () => {
    const chain = buildValidChain(rawEvents);
    const wrongHead = "f".repeat(64);

    const report = verifyEventChain(chain, wrongHead);
    expect(report.status).toBe("failed");
    expect(report.error).toContain("Chain head hash mismatch");
  });
});
