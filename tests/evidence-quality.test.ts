import { describe, it, expect } from "vitest";
import { analyzeEvidenceQuality, QUALITY_DISCLAIMER, ChainedEvent } from "@evidencekit/core";
import { defaultEvidenceQualityService } from "@evidencekit/evidence-server";
import { randomUUID } from "node:crypto";

describe("Phase 4.5 — Evidence Quality & Coverage Test Suite", () => {
  const streamId = `case_quality_${Date.now()}`;

  it("evaluates a clean stream and returns 100% completeness with source coverage", () => {
    const events: ChainedEvent[] = [
      {
        event: {
          schema_version: "1.0",
          event_id: randomUUID(),
          stream_type: "tracevault.case",
          stream_id: streamId,
          event_name: "http.request.received",
          occurred_at: "2026-11-06T10:00:00.000Z",
          observed_at: "2026-11-06T10:00:00.500Z",
          time_confidence: "source_timestamp",
          source: { system: "api-gateway", adapter: "syslog", adapter_version: "1.0" },
          severity: "info",
          attributes: { path: "/health" }
        },
        stream_sequence: 0,
        previous_hash: "0".repeat(64),
        event_hash: "a".repeat(64)
      },
      {
        event: {
          schema_version: "1.0",
          event_id: randomUUID(),
          stream_type: "tracevault.case",
          stream_id: streamId,
          event_name: "db.query.executed",
          occurred_at: "2026-11-06T10:00:01.000Z",
          observed_at: "2026-11-06T10:00:01.200Z",
          time_confidence: "source_timestamp",
          source: { system: "database", adapter: "pg", adapter_version: "1.0" },
          severity: "info",
          attributes: { query: "SELECT 1" }
        },
        stream_sequence: 1,
        previous_hash: "a".repeat(64),
        event_hash: "b".repeat(64)
      }
    ];

    const report = analyzeEvidenceQuality(streamId, events);

    expect(report.streamId).toBe(streamId);
    expect(report.totalEvents).toBe(2);
    expect(report.completenessScore).toBe(100);
    expect(report.issueCount.critical).toBe(0);
    expect(report.issueCount.warning).toBe(0);
    expect(report.disclaimer).toBe(QUALITY_DISCLAIMER);

    // Source coverage breakdown
    expect(report.sourceCoverage.length).toBe(2);
    expect(report.sourceCoverage.find((s) => s.sourceSystem === "api-gateway")?.percentage).toBe(
      50
    );
    expect(report.sourceCoverage.find((s) => s.sourceSystem === "database")?.percentage).toBe(50);
  });

  it("detects duplicate event hashes, invalid timestamps, and clock skew", () => {
    const dupHash = "d".repeat(64);
    const defectiveEvents: ChainedEvent[] = [
      // 1. Duplicate event 1
      {
        event: {
          schema_version: "1.0",
          event_id: "eid_dup_1",
          stream_type: "tracevault.case",
          stream_id: streamId,
          event_name: "dup.event",
          occurred_at: "2026-11-06T10:00:00.000Z",
          observed_at: "2026-11-06T10:00:00.100Z",
          time_confidence: "source_timestamp",
          source: { system: "logger", adapter: "test", adapter_version: "1.0" },
          severity: "info",
          attributes: {}
        },
        stream_sequence: 0,
        previous_hash: "0".repeat(64),
        event_hash: dupHash
      },
      // 2. Duplicate event 2
      {
        event: {
          schema_version: "1.0",
          event_id: "eid_dup_2",
          stream_type: "tracevault.case",
          stream_id: streamId,
          event_name: "dup.event",
          occurred_at: "2026-11-06T10:00:00.000Z",
          observed_at: "2026-11-06T10:00:00.100Z",
          time_confidence: "source_timestamp",
          source: { system: "logger", adapter: "test", adapter_version: "1.0" },
          severity: "info",
          attributes: {}
        },
        stream_sequence: 1,
        previous_hash: dupHash,
        event_hash: dupHash
      },
      // 3. Clock skew (observed 30 seconds before occurred)
      {
        event: {
          schema_version: "1.0",
          event_id: "eid_skew",
          stream_type: "tracevault.case",
          stream_id: streamId,
          event_name: "skewed.event",
          occurred_at: "2026-11-06T10:05:30.000Z",
          observed_at: "2026-11-06T10:05:00.000Z",
          time_confidence: "source_timestamp",
          source: { system: "remote-node", adapter: "test", adapter_version: "1.0" },
          severity: "warning",
          attributes: {}
        },
        stream_sequence: 2,
        previous_hash: dupHash,
        event_hash: "e".repeat(64)
      },
      // 4. Invalid timestamp string
      {
        event: {
          schema_version: "1.0",
          event_id: "eid_bad_ts",
          stream_type: "tracevault.case",
          stream_id: streamId,
          event_name: "bad.timestamp",
          occurred_at: "invalid-iso-string",
          observed_at: "2026-11-06T10:06:00.000Z",
          time_confidence: "source_timestamp",
          source: { system: "legacy-app", adapter: "test", adapter_version: "1.0" },
          severity: "error",
          attributes: {}
        },
        stream_sequence: 3,
        previous_hash: "e".repeat(64),
        event_hash: "f".repeat(64)
      }
    ];

    const report = analyzeEvidenceQuality(streamId, defectiveEvents);

    // Verify duplicate detection
    const dupIssue = report.issues.find((i) => i.ruleCode === "DUPLICATE_EVENT");
    expect(dupIssue).toBeDefined();
    expect(dupIssue?.eventIds).toContain("eid_dup_1");
    expect(dupIssue?.eventIds).toContain("eid_dup_2");

    // Verify clock skew detection
    const skewIssue = report.issues.find((i) => i.ruleCode === "CLOCK_SKEW");
    expect(skewIssue).toBeDefined();
    expect(skewIssue?.eventIds).toContain("eid_skew");

    // Verify invalid timestamp detection
    const tsIssue = report.issues.find((i) => i.ruleCode === "INVALID_TIMESTAMP");
    expect(tsIssue).toBeDefined();
    expect(tsIssue?.severity).toBe("critical");

    // Completeness score is penalized
    expect(report.completenessScore).toBeLessThan(100);
  });

  it("accounts for sensitive token redactions", () => {
    const redactedEvents: ChainedEvent[] = [
      {
        event: {
          schema_version: "1.0",
          event_id: randomUUID(),
          stream_type: "tracevault.case",
          stream_id: streamId,
          event_name: "api.auth.attempt",
          occurred_at: "2026-11-06T11:00:00.000Z",
          observed_at: "2026-11-06T11:00:00.100Z",
          time_confidence: "source_timestamp",
          source: { system: "auth-service", adapter: "test", adapter_version: "1.0" },
          severity: "info",
          attributes: {
            authHeader: "[REDACTED_BEARER_TOKEN]",
            apiKey: "[REDACTED_API_KEY]"
          }
        },
        stream_sequence: 0,
        previous_hash: "0".repeat(64),
        event_hash: "1".repeat(64)
      }
    ];

    const report = analyzeEvidenceQuality(streamId, redactedEvents);
    expect(report.redactionCount).toBe(2);
    const redactionIssue = report.issues.find((i) => i.ruleCode === "SENSITIVE_REDACTION");
    expect(redactionIssue).toBeDefined();
    expect(redactionIssue?.severity).toBe("info");
  });

  it("generates formatted Markdown quality audit report with causality disclaimers", () => {
    const ev: ChainedEvent = {
      event: {
        schema_version: "1.0",
        event_id: randomUUID(),
        stream_type: "tracevault.case",
        stream_id: streamId,
        event_name: "system.reboot",
        occurred_at: "2026-11-06T12:00:00.000Z",
        observed_at: "2026-11-06T12:00:01.000Z",
        time_confidence: "source_timestamp",
        source: { system: "k8s-node", adapter: "test", adapter_version: "1.0" },
        severity: "warning",
        attributes: { reason: "OOM" }
      },
      stream_sequence: 0,
      previous_hash: "0".repeat(64),
      event_hash: "2".repeat(64)
    };

    const report = analyzeEvidenceQuality(streamId, [ev]);
    const markdown = defaultEvidenceQualityService.generateMarkdownQualityReport(report);

    expect(markdown).toContain("# Evidence Quality & Completeness Report");
    expect(markdown).toContain("**Completeness Score:** 100/100");
    expect(markdown).toContain(QUALITY_DISCLAIMER);
    expect(markdown).toContain("`k8s-node`");
  });
});
