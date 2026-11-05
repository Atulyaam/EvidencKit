import { normalizeEvent, RawEventInput } from "@evidencekit/core";

export interface GitCommitRecord {
  sha: string;
  author: string;
  email: string;
  timestamp: string;
  message: string;
  changed_files?: string[];
}

export function parseGitHistoryToEvents(
  commits: GitCommitRecord[],
  streamId: string,
  artifactId: string
) {
  return commits.map((commit, index) => {
    const raw: RawEventInput = {
      stream_type: "tracevault.case",
      stream_id: streamId,
      event_name: "git.commit.pushed",
      occurred_at: commit.timestamp,
      time_confidence: "source_timestamp",
      source: {
        system: "git",
        artifact_id: artifactId,
        adapter: "git-json",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "user",
        id: commit.email || commit.author
      },
      severity: "info",
      correlation_ids: [commit.sha],
      attributes: {
        sha: commit.sha,
        author: commit.author,
        message: commit.message,
        changed_files_count: commit.changed_files?.length || 0
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
