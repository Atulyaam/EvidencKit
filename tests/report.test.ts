import { describe, it, expect } from "vitest";
import { ReportService, IncidentRecord } from "@evidencekit/evidence-server";
import { ChainedEvent, computeEventHash, INITIAL_PREVIOUS_HASH } from "@evidencekit/core";

describe("Phase 3 — Task 3.9: Incident Investigation Report Generator", () => {
  const service = new ReportService();

  const incident: IncidentRecord = {
    id: "case_report_test",
    workspaceId: "ws_demo_default",
    title: "Database Lock & Worker Starvation",
    description: "Production incident triggered by unindexed foreign key migration.",
    severity: "critical",
    environment: "production",
    status: "mitigated",
    createdAt: "2026-11-16T10:00:00.000Z",
    updatedAt: "2026-11-16T10:45:00.000Z"
  };

  const e1 = {
    schema_version: "1.0" as const,
    event_id: "00000000-0000-4000-8000-000000000001",
    stream_type: "tracevault.case" as const,
    stream_id: incident.id,
    event_name: "git.commit.pushed",
    occurred_at: "2026-11-16T10:00:00.000Z",
    observed_at: "2026-11-16T10:00:05.000Z",
    time_confidence: "source_timestamp" as const,
    source: { system: "git", adapter: "git-json", adapter_version: "1.0.0" },
    severity: "info" as const,
    attributes: { sha: "abcdef123", message: "apply migration" },
    evidence_refs: []
  };

  const h1 = computeEventHash(e1, INITIAL_PREVIOUS_HASH);
  const events: ChainedEvent[] = [
    {
      event: e1,
      stream_sequence: 0,
      previous_hash: INITIAL_PREVIOUS_HASH,
      event_hash: h1
    }
  ];

  it("generates a complete 12-section investigation report", () => {
    const report = service.generateReport(incident, events, [
      {
        id: "art_1",
        stream_id: incident.id,
        filename: "git.json",
        media_type: "application/json",
        size_bytes: 1024,
        sha256: "0".repeat(64)
      }
    ]);

    expect(report.metadata.title).toBe(incident.title);
    expect(report.integrity.status).toBe("verified");
    expect(report.eventCounts.total).toBe(1);
    expect(report.gitActivity.length).toBe(1);
    expect(report.limitations.length).toBeGreaterThan(0);
  });

  it("exports publication-ready Markdown with markdown headers and tables", () => {
    const report = service.generateReport(incident, events);
    const md = service.reportToMarkdown(report);

    expect(md).toContain("# Incident Investigation Report:");
    expect(md).toContain("## 1. Executive Summary");
    expect(md).toContain("## 2. Incident Metadata");
    expect(md).toContain("## 7. Cryptographic Chain Verification");
    expect(md).toContain("VERIFIED");
  });
});
