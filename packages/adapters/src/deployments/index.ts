import { normalizeEvent, RawEventInput } from "@evidencekit/core";

export interface DeploymentRecord {
  deployment_id: string;
  environment: string;
  service: string;
  commit_sha: string;
  status: "started" | "completed" | "failed";
  timestamp: string;
  deployed_by?: string;
  details?: Record<string, unknown>;
}

export function parseDeploymentsToEvents(
  records: DeploymentRecord[],
  streamId: string,
  artifactId: string
) {
  return records.map((dep, index) => {
    const raw: RawEventInput = {
      stream_type: "tracevault.case",
      stream_id: streamId,
      event_name: `deployment.${dep.status}`,
      occurred_at: dep.timestamp,
      time_confidence: "source_timestamp",
      source: {
        system: "deployer",
        artifact_id: artifactId,
        adapter: "deployment-json",
        adapter_version: "1.0.0"
      },
      actor: {
        type: dep.deployed_by ? "user" : "service",
        id: dep.deployed_by || "auto-deployer"
      },
      severity: dep.status === "failed" ? "critical" : "info",
      correlation_ids: [dep.deployment_id, dep.commit_sha],
      attributes: {
        deployment_id: dep.deployment_id,
        environment: dep.environment,
        service: dep.service,
        commit_sha: dep.commit_sha,
        status: dep.status,
        ...(dep.details || {})
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
