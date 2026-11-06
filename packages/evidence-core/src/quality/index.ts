import { z } from "zod";
import { ChainedEvent } from "../chain/index";

export const QualityIssueSeveritySchema = z.enum(["info", "warning", "critical"]);
export type QualityIssueSeverity = z.infer<typeof QualityIssueSeveritySchema>;

export const QualityRuleCodeSchema = z.enum([
  "MISSING_SOURCE_INFO",
  "DUPLICATE_EVENT",
  "INVALID_TIMESTAMP",
  "CLOCK_SKEW",
  "MISSING_PROVENANCE",
  "BROKEN_EVIDENCE_REF",
  "FAILED_INGESTION_RECORD",
  "SENSITIVE_REDACTION"
]);
export type QualityRuleCode = z.infer<typeof QualityRuleCodeSchema>;

export const EvidenceQualityIssueSchema = z.object({
  id: z.string(),
  ruleCode: QualityRuleCodeSchema,
  severity: QualityIssueSeveritySchema,
  message: z.string(),
  explanation: z.string(),
  eventIds: z.array(z.string()),
  suggestedRemediation: z.string()
});
export type EvidenceQualityIssue = z.infer<typeof EvidenceQualityIssueSchema>;

export const SourceCoverageMetricSchema = z.object({
  sourceSystem: z.string(),
  eventCount: z.number(),
  percentage: z.number()
});
export type SourceCoverageMetric = z.infer<typeof SourceCoverageMetricSchema>;

export const EvidenceQualityReportSchema = z.object({
  streamId: z.string(),
  analyzedAt: z.string(),
  totalEvents: z.number(),
  completenessScore: z.number().min(0).max(100),
  issueCount: z.object({
    total: z.number(),
    critical: z.number(),
    warning: z.number(),
    info: z.number()
  }),
  issues: z.array(EvidenceQualityIssueSchema),
  sourceCoverage: z.array(SourceCoverageMetricSchema),
  redactionCount: z.number(),
  disclaimer: z.string()
});
export type EvidenceQualityReport = z.infer<typeof EvidenceQualityReportSchema>;

export const QUALITY_DISCLAIMER =
  "CRITICAL NOTICE: This forensic quality analysis assesses structural completeness, metadata consistency, and cryptographic sequence integrity across evidence logs. It does NOT claim that the underlying source evidence is truthful, nor does it prove causal relationships.";

/**
 * Pure, deterministic analyzer that evaluates evidence stream quality.
 */
export function analyzeEvidenceQuality(
  streamId: string,
  events: ChainedEvent[]
): EvidenceQualityReport {
  const analyzedAt = new Date().toISOString();
  const issues: EvidenceQualityIssue[] = [];

  if (events.length === 0) {
    return {
      streamId,
      analyzedAt,
      totalEvents: 0,
      completenessScore: 0,
      issueCount: { total: 1, critical: 1, warning: 0, info: 0 },
      issues: [
        {
          id: "iss_empty_stream",
          ruleCode: "MISSING_SOURCE_INFO",
          severity: "critical",
          message: "Empty Evidence Stream",
          explanation: "The evidence stream contains zero recorded events.",
          eventIds: [],
          suggestedRemediation: "Ingest evidence logs or artifacts to establish forensic timeline."
        }
      ],
      sourceCoverage: [],
      redactionCount: 0,
      disclaimer: QUALITY_DISCLAIMER
    };
  }

  const seenHashes = new Map<string, string[]>();
  const sourceCounts = new Map<string, number>();
  let redactionTally = 0;

  for (const chained of events) {
    const ev = chained.event;
    const eid = ev.event_id;

    // 1. Check duplicate event hash
    const h = chained.event_hash;
    const existing = seenHashes.get(h) || [];
    existing.push(eid);
    seenHashes.set(h, existing);

    // 2. Source metadata completeness
    if (!ev.source?.system || ev.source.system.trim() === "" || ev.source.system === "unknown") {
      issues.push({
        id: `iss_src_${eid}`,
        ruleCode: "MISSING_SOURCE_INFO",
        severity: "warning",
        message: `Incomplete Source System Metadata in event #${chained.stream_sequence}`,
        explanation: `Event ${eid} lacks a designated source system identifier.`,
        eventIds: [eid],
        suggestedRemediation: "Ensure ingestion adapters provide source.system in the event envelope."
      });
    }

    // Source coverage tracking
    const sys = ev.source?.system || "unspecified";
    sourceCounts.set(sys, (sourceCounts.get(sys) || 0) + 1);

    // 3. Timestamp validity & clock skew
    const tOccurred = Date.parse(ev.occurred_at || "");
    const tObserved = Date.parse(ev.observed_at);

    if (isNaN(tOccurred)) {
      issues.push({
        id: `iss_ts_${eid}`,
        ruleCode: "INVALID_TIMESTAMP",
        severity: "critical",
        message: `Invalid occurred_at timestamp in event #${chained.stream_sequence}`,
        explanation: `Value '${ev.occurred_at}' is not a valid ISO 8601 timestamp string.`,
        eventIds: [eid],
        suggestedRemediation: "Normalize timestamps to UTC ISO 8601 during ingestion."
      });
    }

    if (!isNaN(tOccurred) && !isNaN(tObserved)) {
      // Clock skew: observation occurred more than 10 seconds before occurrence
      if (tObserved < tOccurred - 10000) {
        issues.push({
          id: `iss_skew_${eid}`,
          ruleCode: "CLOCK_SKEW",
          severity: "warning",
          message: `Clock skew detected in event #${chained.stream_sequence}`,
          explanation: `observed_at (${ev.observed_at}) precedes occurred_at (${ev.occurred_at}) by more than 10s.`,
          eventIds: [eid],
          suggestedRemediation: "Synchronize host clocks using NTP or adjust client logger timestamps."
        });
      }
    }

    // 4. Cryptographic Provenance Completeness
    if (!chained.previous_hash || chained.previous_hash.trim() === "") {
      issues.push({
        id: `iss_prov_${eid}`,
        ruleCode: "MISSING_PROVENANCE",
        severity: "critical",
        message: `Missing previous_hash in chained event #${chained.stream_sequence}`,
        explanation: "Event lacks cryptographic previous_hash anchor.",
        eventIds: [eid],
        suggestedRemediation: "Re-anchor stream to genesis block or previous event hash."
      });
    }

    // 5. Redaction Accounting
    const serialized = JSON.stringify(ev.attributes || {});
    const redactionMatches = serialized.match(/\[REDACTED_[A-Z0-9_]+\]/g);
    if (redactionMatches) {
      redactionTally += redactionMatches.length;
    }
  }

  // Check duplicate hash issues
  for (const [hash, eids] of seenHashes.entries()) {
    if (eids.length > 1) {
      issues.push({
        id: `iss_dup_${hash.slice(0, 12)}`,
        ruleCode: "DUPLICATE_EVENT",
        severity: "warning",
        message: `Duplicate Event Detected (${eids.length} identical hashes)`,
        explanation: `Identical SHA-256 event hash '${hash.slice(0, 16)}...' appears ${eids.length} times in stream.`,
        eventIds: eids,
        suggestedRemediation: "Deduplicate log sources before batch ingestion to prevent redundancy."
      });
    }
  }

  if (redactionTally > 0) {
    issues.push({
      id: `iss_redact_tally`,
      ruleCode: "SENSITIVE_REDACTION",
      severity: "info",
      message: `${redactionTally} Sensitive Secret(s) Redacted Before Ingestion`,
      explanation: `Automated sanitizer masked ${redactionTally} sensitive tokens (API keys, tokens, or credentials) to prevent credential leakage.`,
      eventIds: [],
      suggestedRemediation: "No action required; redactions are preserved securely in the cryptographic ledger."
    });
  }

  // Source coverage calculation
  const total = events.length;
  const sourceCoverage: SourceCoverageMetric[] = [];
  for (const [src, count] of sourceCounts.entries()) {
    sourceCoverage.push({
      sourceSystem: src,
      eventCount: count,
      percentage: Math.round((count / total) * 1000) / 10
    });
  }

  // Completeness score: starts at 100, drops 15 per critical issue, 5 per warning issue
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  const penalty = criticalCount * 15 + warningCount * 5;
  const completenessScore = Math.max(0, Math.min(100, 100 - penalty));

  return {
    streamId,
    analyzedAt,
    totalEvents: total,
    completenessScore,
    issueCount: {
      total: issues.length,
      critical: criticalCount,
      warning: warningCount,
      info: infoCount
    },
    issues,
    sourceCoverage,
    redactionCount: redactionTally,
    disclaimer: QUALITY_DISCLAIMER
  };
}
