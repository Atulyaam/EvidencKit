import { describe, it, expect } from "vitest";
import {
  parseCiLogToEvents,
  parseGitHistoryToEvents,
  parseDeploymentsToEvents,
  parseAppLogsToEvents,
  CiRecord,
  GitCommitRecord,
  DeploymentRecord
} from "@evidencekit/adapters";

describe("Phase 2 — Source Evidence Adapters", () => {
  const streamId = "case_adapters_01";
  const artifactId = "art_adapter_01";

  it("parses CI log records to canonical events with record_number locators", () => {
    const ciRecords: CiRecord[] = [
      {
        job_id: "job-101",
        workflow_name: "Build & Test",
        status: "failure",
        started_at: "2026-11-16T09:00:00.000Z",
        completed_at: "2026-11-16T09:05:00.000Z",
        commit_sha: "c0ffee1",
        error_message: "Compilation error: missing module"
      }
    ];

    const events = parseCiLogToEvents(ciRecords, streamId, artifactId);

    expect(events.length).toBe(1);
    expect(events[0]!.event_name).toBe("ci.job.failure");
    expect(events[0]!.severity).toBe("error");
    expect(events[0]!.evidence_refs?.[0]?.locator_type).toBe("record_number");
    expect(events[0]!.evidence_refs?.[0]?.locator).toBe("1");
    expect(events[0]!.correlation_ids).toContain("c0ffee1");
  });

  it("parses Git commit history to canonical events", () => {
    const gitCommits: GitCommitRecord[] = [
      {
        sha: "a1b2c3d",
        author: "Dev Lead",
        email: "lead@corp.com",
        timestamp: "2026-11-16T08:30:00.000Z",
        message: "feat: add index",
        changed_files: ["src/db.ts", "src/index.ts"]
      }
    ];

    const events = parseGitHistoryToEvents(gitCommits, streamId, artifactId);

    expect(events.length).toBe(1);
    expect(events[0]!.event_name).toBe("git.commit.pushed");
    expect(events[0]!.actor?.id).toBe("lead@corp.com");
    expect(events[0]!.correlation_ids).toContain("a1b2c3d");
  });

  it("parses deployment records to canonical events", () => {
    const depRecords: DeploymentRecord[] = [
      {
        deployment_id: "dep-909",
        environment: "staging",
        service: "auth",
        commit_sha: "a1b2c3d",
        status: "failed",
        timestamp: "2026-11-16T09:10:00.000Z"
      }
    ];

    const events = parseDeploymentsToEvents(depRecords, streamId, artifactId);

    expect(events.length).toBe(1);
    expect(events[0]!.event_name).toBe("deployment.failed");
    expect(events[0]!.severity).toBe("critical");
    expect(events[0]!.correlation_ids).toContain("dep-909");
  });

  it("parses structured and unstructured application logs with line_number locators", () => {
    const logLines = [
      JSON.stringify({
        timestamp: "2026-11-16T09:15:00.000Z",
        level: "error",
        message: "Database connection timeout after 5000ms",
        trace_id: "trace-xyz-123"
      }),
      "Plain raw log line without json formatting"
    ];

    const events = parseAppLogsToEvents(logLines, streamId, artifactId);

    expect(events.length).toBe(2);
    expect(events[0]!.event_name).toBe("app.log.error");
    expect(events[0]!.evidence_refs?.[0]?.locator_type).toBe("line_number");
    expect(events[0]!.evidence_refs?.[0]?.locator).toBe("1");
    expect(events[0]!.correlation_ids).toContain("trace-xyz-123");

    expect(events[1]!.event_name).toBe("app.log.raw");
    expect(events[1]!.evidence_refs?.[0]?.locator).toBe("2");
  });
});
