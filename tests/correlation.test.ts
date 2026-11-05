import { describe, it, expect } from "vitest";
import { discoverCorrelations, ChainedEvent, EvidenceEvent } from "@evidencekit/core";

function makeEvent(
  id: string,
  eventName: string,
  occurredAt: string,
  severity: "info" | "warning" | "error" | "critical",
  attributes: Record<string, unknown> = {},
  correlationIds: string[] = []
): ChainedEvent {
  const event: EvidenceEvent = {
    schema_version: "1.0",
    event_id: id,
    stream_type: "tracevault.case",
    stream_id: "stream_corr_test",
    event_name: eventName,
    occurred_at: occurredAt,
    observed_at: occurredAt,
    time_confidence: "source_timestamp",
    source: {
      system: "test",
      adapter: "test",
      adapter_version: "1.0.0"
    },
    severity,
    correlation_ids: correlationIds,
    attributes,
    evidence_refs: []
  };

  return {
    event,
    stream_sequence: 0,
    previous_hash: "0".repeat(64),
    event_hash: "1".repeat(64)
  };
}

describe("Phase 3 — Task 3.8: Candidate Correlation Engine", () => {
  it("correlates CI failure with Git commit sharing the same commit SHA (TV-COR-002)", () => {
    const e1 = makeEvent("1", "git.commit.pushed", "2026-11-16T10:00:00.000Z", "info", {
      sha: "c0ffee123"
    });
    const e2 = makeEvent("2", "ci.job.failure", "2026-11-16T10:05:00.000Z", "error", {
      commit_sha: "c0ffee123"
    });

    const correlations = discoverCorrelations([e1, e2]);

    expect(correlations.length).toBe(1);
    expect(correlations[0]!.rule_id).toBe("TV-COR-002");
    expect(correlations[0]!.confidence).toBe("high");
    expect(correlations[0]!.matching_signals).toContain("commit_sha: c0ffee123");
    expect(correlations[0]!.caveat).toContain("Does not independently prove causality");
  });

  it("correlates deployment failure followed by application errors in shared environment (TV-COR-001)", () => {
    const e1 = makeEvent("1", "deployment.failed", "2026-11-16T10:00:00.000Z", "critical", {
      service: "api-gateway",
      environment: "production"
    });
    const e2 = makeEvent("2", "app.log.error", "2026-11-16T10:02:30.000Z", "error", {
      service: "api-gateway",
      environment: "production",
      message: "Upstream connection refused"
    });

    const correlations = discoverCorrelations([e1, e2]);

    expect(correlations.length).toBe(1);
    expect(correlations[0]!.rule_id).toBe("TV-COR-001");
    expect(correlations[0]!.confidence).toBe("high");
    expect(correlations[0]!.time_delta_seconds).toBe(150);
  });

  it("correlates events sharing a common trace/correlation ID (TV-COR-004)", () => {
    const e1 = makeEvent("1", "payment.requested", "2026-11-16T10:00:00.000Z", "info", {}, [
      "req-trace-xyz-999"
    ]);
    const e2 = makeEvent("2", "payment.failed", "2026-11-16T10:01:00.000Z", "error", {}, [
      "req-trace-xyz-999"
    ]);

    const correlations = discoverCorrelations([e1, e2]);

    expect(correlations.length).toBe(1);
    expect(correlations[0]!.rule_id).toBe("TV-COR-004");
    expect(correlations[0]!.matching_signals).toContain("correlation_id: req-trace-xyz-999");
  });

  it("returns zero correlations for unrelated events outside the time window", () => {
    const e1 = makeEvent("1", "git.push", "2026-11-16T08:00:00.000Z", "info", { sha: "aaa" });
    const e2 = makeEvent("2", "ci.job.failure", "2026-11-16T18:00:00.000Z", "error", {
      sha: "bbb"
    });

    const correlations = discoverCorrelations([e1, e2], { windowSeconds: 300 });
    expect(correlations.length).toBe(0);
  });

  it("produces deterministic candidate correlations regardless of run count", () => {
    const e1 = makeEvent("1", "git.commit.pushed", "2026-11-16T10:00:00.000Z", "info", {
      sha: "sha999"
    });
    const e2 = makeEvent("2", "ci.job.failure", "2026-11-16T10:02:00.000Z", "error", {
      commit_sha: "sha999"
    });

    const run1 = discoverCorrelations([e1, e2]);
    const run2 = discoverCorrelations([e1, e2]);

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });
});
