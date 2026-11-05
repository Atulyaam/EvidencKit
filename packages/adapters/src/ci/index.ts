import { normalizeEvent, RawEventInput } from "@evidencekit/core";

export interface CiRecord {
  job_id: string;
  workflow_name: string;
  status: "success" | "failure" | "cancelled";
  started_at: string;
  completed_at: string;
  commit_sha?: string;
  runner?: string;
  error_message?: string;
}

export function parseCiLogToEvents(records: CiRecord[], streamId: string, artifactId: string) {
  return records.map((rec, index) => {
    const raw: RawEventInput = {
      stream_type: "tracevault.case",
      stream_id: streamId,
      event_name: `ci.job.${rec.status}`,
      occurred_at: rec.completed_at || rec.started_at,
      time_confidence: "source_timestamp",
      source: {
        system: "github-actions",
        artifact_id: artifactId,
        adapter: "ci-json",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "service",
        id: rec.runner || "ci-runner"
      },
      severity: rec.status === "failure" ? "error" : "info",
      correlation_ids: rec.commit_sha ? [rec.commit_sha, rec.job_id] : [rec.job_id],
      attributes: {
        workflow: rec.workflow_name,
        job_id: rec.job_id,
        status: rec.status,
        ...(rec.error_message ? { error: rec.error_message } : {})
      },
      evidence_refs: [
        {
          artifact_id: artifactId,
          locator_type: "record_number",
          locator: String(index + 1)
        }
      ]
    };

    return normalizeEvent(raw);
  });
}
