import { describe, it } from "vitest";
import fc from "fast-check";
import {
  canonicalizeJson,
  computeEventHash,
  verifyEventChain,
  INITIAL_PREVIOUS_HASH,
  ChainedEvent,
  sortEventsForTimeline,
  EvidenceEvent,
  sanitizeData
} from "@evidencekit/core";

describe("Phase 2 — Property-Based Invariant Tests (fast-check)", () => {
  it("property: JCS canonicalization is deterministic regardless of key order", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter((k) => k !== "__proto__" && k !== "constructor" && k !== "prototype"),
          fc.jsonValue()
        ),
        (dict) => {
          const keys = Object.keys(dict);
          const shuffledKeys = [...keys].reverse();
          const dictShuffled: Record<string, unknown> = {};
          shuffledKeys.forEach((k) => (dictShuffled[k] = dict[k]));

          const jcs1 = canonicalizeJson(dict);
          const jcs2 = canonicalizeJson(dictShuffled);

          return jcs1 === jcs2;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("property: arbitrary generated event chains always satisfy verification invariant", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 20 }),
        (messages) => {
          const streamId = "stream-prop-chain";
          const chain: ChainedEvent[] = [];
          let prev = INITIAL_PREVIOUS_HASH;

          for (let i = 0; i < messages.length; i++) {
            const ev: EvidenceEvent = {
              schema_version: "1.0",
              event_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
              stream_type: "tracevault.case",
              stream_id: streamId,
              event_name: "property.test.event",
              occurred_at: new Date(1700000000000 + i * 1000).toISOString(),
              observed_at: new Date(1700000000000 + i * 1000 + 500).toISOString(),
              time_confidence: "source_timestamp",
              source: {
                system: "prop-tester",
                adapter: "prop-adapter",
                adapter_version: "1.0.0"
              },
              severity: "info",
              attributes: { message: messages[i] },
              evidence_refs: []
            };

            const hash = computeEventHash(ev, prev);
            chain.push({
              event: ev,
              stream_sequence: i,
              previous_hash: prev,
              event_hash: hash
            });
            prev = hash;
          }

          const report = verifyEventChain(chain);
          return (
            report.status === "verified" &&
            report.total_events === messages.length &&
            report.head_hash === chain[chain.length - 1]!.event_hash
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it("property: timeline sorting preserves chronological ordering invariant", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1000000000, max: 2000000000 }), { minLength: 2, maxLength: 30 }),
        (timestamps) => {
          const events: ChainedEvent[] = timestamps.map((ts, idx) => ({
            event: {
              schema_version: "1.0",
              event_id: `00000000-0000-4000-8000-${String(idx).padStart(12, "0")}`,
              stream_type: "tracevault.case",
              stream_id: "prop-stream",
              event_name: "test",
              occurred_at: new Date(ts).toISOString(),
              observed_at: new Date().toISOString(),
              time_confidence: "source_timestamp",
              source: { system: "test", adapter: "test", adapter_version: "1.0.0" },
              severity: "info",
              attributes: {},
              evidence_refs: []
            },
            stream_sequence: idx,
            previous_hash: "0".repeat(64),
            event_hash: "1".repeat(64)
          }));

          const sorted = sortEventsForTimeline(events);

          for (let i = 0; i < sorted.length - 1; i++) {
            const timeCurrent = new Date(sorted[i]!.event.occurred_at!).getTime();
            const timeNext = new Date(sorted[i + 1]!.event.occurred_at!).getTime();
            if (timeCurrent > timeNext) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it("property: secret sanitization removes all injected API keys", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 30 }).map((s) => s.replace(/[^a-zA-Z0-9]/g, "a")),
        (tokenBody) => {
          const fakeKey = `sk-${tokenBody.padEnd(20, "x")}`;
          const dirty = { config: { secret: fakeKey }, note: `Used key ${fakeKey}` };
          const result = sanitizeData(dirty);

          const serialized = JSON.stringify(result.sanitized);
          return !serialized.includes(fakeKey);
        }
      ),
      { numRuns: 50 }
    );
  });
});
