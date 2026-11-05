import { ChainedEvent } from "../chain/index";

export type CorrelationConfidence = "high" | "medium" | "low";

export interface CandidateCorrelation {
  id: string;
  rule_id: string;
  rule_name: string;
  explanation: string;
  confidence: CorrelationConfidence;
  matching_signals: string[];
  event_ids: [string, string];
  time_delta_seconds: number | null;
  caveat: string;
}

export interface CorrelationEngineOptions {
  windowSeconds?: number; // default 15 minutes = 900 seconds
}

const DEFAULT_CAVEAT =
  "Candidate correlation identified via deterministic rules. Does not independently prove causality.";

/**
 * Deterministic Candidate Correlation Engine for TraceVault.
 * Evaluates candidate relationships between events without opaque heuristics or LLM dependencies.
 */
export function discoverCorrelations(
  events: ChainedEvent[],
  options: CorrelationEngineOptions = {}
): CandidateCorrelation[] {
  const windowSeconds = options.windowSeconds ?? 900;
  const correlations: CandidateCorrelation[] = [];
  const seenPairs = new Set<string>();

  // Filter out events without valid occurred_at for time-based rules
  const timedEvents = events.filter((e) => e.event.occurred_at !== null);

  for (let i = 0; i < timedEvents.length; i++) {
    const evA = timedEvents[i]!;
    const timeA = new Date(evA.event.occurred_at!).getTime() / 1000;

    for (let j = i + 1; j < timedEvents.length; j++) {
      const evB = timedEvents[j]!;
      const timeB = new Date(evB.event.occurred_at!).getTime() / 1000;
      const deltaSec = Math.abs(timeB - timeA);

      if (deltaSec > windowSeconds) {
        // If sorted chronologically, we could break, but let's check bounded window
        continue;
      }

      const pairKey = [evA.event.event_id, evB.event.event_id].sort().join("<->");
      if (seenPairs.has(pairKey)) continue;

      // RULE TV-COR-002: CI Failure & Commit SHA Match
      const commitShaA = evA.event.attributes["sha"] || evA.event.attributes["commit_sha"];
      const commitShaB = evB.event.attributes["sha"] || evB.event.attributes["commit_sha"];
      const isCiFailure =
        (evA.event.event_name.includes("ci.") && evA.event.severity === "error") ||
        (evB.event.event_name.includes("ci.") && evB.event.severity === "error");
      const isGitCommit =
        evA.event.event_name.includes("git.") || evB.event.event_name.includes("git.");

      if (commitShaA && commitShaB && commitShaA === commitShaB && isCiFailure && isGitCommit) {
        seenPairs.add(pairKey);
        correlations.push({
          id: `cor_${correlations.length + 1}`,
          rule_id: "TV-COR-002",
          rule_name: "CI Workflow Failure References Commit SHA",
          explanation: `Failed CI pipeline references commit SHA '${commitShaA}'.`,
          confidence: "high",
          matching_signals: [`commit_sha: ${commitShaA}`, `time_delta: ${Math.round(deltaSec)}s`],
          event_ids: [evA.event.event_id, evB.event.event_id],
          time_delta_seconds: Math.round(deltaSec),
          caveat: DEFAULT_CAVEAT
        });
        continue;
      }

      // RULE TV-COR-001: Deployment Failure Followed by Application Error (Shared Service/Env)
      const isDeployFailure =
        (evA.event.event_name.includes("deployment.") &&
          (evA.event.severity === "critical" || evA.event.severity === "error")) ||
        (evB.event.event_name.includes("deployment.") &&
          (evB.event.severity === "critical" || evB.event.severity === "error"));
      const isAppError =
        (evA.event.event_name.includes("app.log.") &&
          (evA.event.severity === "error" || evA.event.severity === "critical")) ||
        (evB.event.event_name.includes("app.log.") &&
          (evB.event.severity === "error" || evB.event.severity === "critical"));

      const serviceA = evA.event.attributes["service"];
      const serviceB = evB.event.attributes["service"];
      const envA = evA.event.attributes["environment"];
      const envB = evB.event.attributes["environment"];

      const sharedService = serviceA && serviceB && serviceA === serviceB;
      const sharedEnv = envA && envB && envA === envB;

      if (isDeployFailure && isAppError && (sharedService || sharedEnv)) {
        seenPairs.add(pairKey);
        const signals = [`time_delta: ${Math.round(deltaSec)}s`];
        if (sharedService) signals.push(`service: ${serviceA}`);
        if (sharedEnv) signals.push(`environment: ${envA}`);

        correlations.push({
          id: `cor_${correlations.length + 1}`,
          rule_id: "TV-COR-001",
          rule_name: "Deployment Failure Followed by Application Errors",
          explanation: `Deployment failure preceded application errors within ${Math.round(deltaSec)}s in environment '${envA || "shared"}'.`,
          confidence: sharedService ? "high" : "medium",
          matching_signals: signals,
          event_ids: [evA.event.event_id, evB.event.event_id],
          time_delta_seconds: Math.round(deltaSec),
          caveat: DEFAULT_CAVEAT
        });
        continue;
      }

      // RULE TV-COR-004: Shared Correlation/Trace Identifier
      const corrA = evA.event.correlation_ids || [];
      const corrB = evB.event.correlation_ids || [];
      const commonCorr = corrA.find((c) => corrB.includes(c));

      if (commonCorr) {
        seenPairs.add(pairKey);
        correlations.push({
          id: `cor_${correlations.length + 1}`,
          rule_id: "TV-COR-004",
          rule_name: "Shared Correlation or Trace Identifier",
          explanation: `Events share common trace or correlation identifier '${commonCorr}'.`,
          confidence: "high",
          matching_signals: [
            `correlation_id: ${commonCorr}`,
            `time_delta: ${Math.round(deltaSec)}s`
          ],
          event_ids: [evA.event.event_id, evB.event.event_id],
          time_delta_seconds: Math.round(deltaSec),
          caveat: DEFAULT_CAVEAT
        });
        continue;
      }

      // RULE TV-COR-005: Clustered Critical/Error Events within Short Window (<120s)
      const isCriticalOrErrorA =
        evA.event.severity === "critical" || evA.event.severity === "error";
      const isCriticalOrErrorB =
        evB.event.severity === "critical" || evB.event.severity === "error";

      if (isCriticalOrErrorA && isCriticalOrErrorB && deltaSec <= 120) {
        seenPairs.add(pairKey);
        correlations.push({
          id: `cor_${correlations.length + 1}`,
          rule_id: "TV-COR-005",
          rule_name: "Temporal Proximity of High-Severity Events",
          explanation: `Critical/error events occurred in rapid succession within ${Math.round(deltaSec)}s.`,
          confidence: "low",
          matching_signals: [
            `time_delta: ${Math.round(deltaSec)}s`,
            `severity: ${evA.event.severity}, ${evB.event.severity}`
          ],
          event_ids: [evA.event.event_id, evB.event.event_id],
          time_delta_seconds: Math.round(deltaSec),
          caveat: DEFAULT_CAVEAT
        });
      }
    }
  }

  return correlations;
}
