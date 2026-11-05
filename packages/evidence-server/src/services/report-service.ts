import {
  ChainedEvent,
  verifyEventChain,
  VerificationResult,
  ArtifactMetadata,
  discoverCorrelations,
  CandidateCorrelation
} from "@evidencekit/core";
import { IncidentRecord } from "./incident-service";

export interface EventBreakdown {
  total: number;
  bySeverity: Record<string, number>;
  bySystem: Record<string, number>;
}

export interface IncidentInvestigationReport {
  generatedAt: string;
  reportVersion: string;
  // 1. Summary
  summary: string;
  // 2. Incident Metadata
  metadata: {
    incidentId: string;
    workspaceId: string;
    title: string;
    description: string | null;
    severity: string;
    environment: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  // 3. Evidence Sources
  sources: Array<{
    id: string;
    filename: string;
    sha256: string;
    sizeBytes: number;
  }>;
  // 4. Event Counts
  eventCounts: EventBreakdown;
  // 5. Timeline Highlights
  highlights: {
    firstEventAt: string | null;
    lastEventAt: string | null;
    durationMinutes: number | null;
    criticalEventsCount: number;
  };
  // 6. Git Activity
  gitActivity: Array<{
    sha: string;
    author: string;
    message: string;
    timestamp: string;
  }>;
  // 7. CI Activity
  ciActivity: Array<{
    jobId: string;
    workflow: string;
    status: string;
    timestamp: string;
  }>;
  // 8. Deployment Activity
  deploymentActivity: Array<{
    deploymentId: string;
    environment: string;
    status: string;
    timestamp: string;
  }>;
  // 9. Candidate Correlations
  correlations: CandidateCorrelation[];
  // 10. Evidence Integrity Status
  integrity: VerificationResult;
  // 11. Investigation Limitations
  limitations: string[];
  // 12. Source References
  sourceReferences: Array<{
    eventId: string;
    eventName: string;
    locator: string;
  }>;
}

export class ReportService {
  /**
   * Deterministically generates an incident investigation report from captured evidence.
   */
  public generateReport(
    incident: IncidentRecord,
    events: ChainedEvent[],
    artifacts: ArtifactMetadata[] = []
  ): IncidentInvestigationReport {
    // 10. Integrity Verification
    const integrity = verifyEventChain(events);

    // 4. Event Counts
    const bySeverity: Record<string, number> = {};
    const bySystem: Record<string, number> = {};

    for (const item of events) {
      const sev = item.event.severity;
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
      const sys = item.event.source.system;
      bySystem[sys] = (bySystem[sys] || 0) + 1;
    }

    // 5. Timeline Highlights
    const timedEvents = events
      .filter((e) => e.event.occurred_at !== null)
      .map((e) => ({
        ...e,
        timeMs: new Date(e.event.occurred_at!).getTime()
      }))
      .sort((a, b) => a.timeMs - b.timeMs);

    const firstEvent = timedEvents[0];
    const lastEvent = timedEvents[timedEvents.length - 1];
    let durationMinutes: number | null = null;
    if (firstEvent && lastEvent && firstEvent.timeMs !== lastEvent.timeMs) {
      durationMinutes = Math.round((lastEvent.timeMs - firstEvent.timeMs) / (1000 * 60));
    }

    // 6. Git Activity
    const gitActivity: IncidentInvestigationReport["gitActivity"] = [];
    // 7. CI Activity
    const ciActivity: IncidentInvestigationReport["ciActivity"] = [];
    // 8. Deployment Activity
    const deploymentActivity: IncidentInvestigationReport["deploymentActivity"] = [];
    // 12. Source References
    const sourceReferences: IncidentInvestigationReport["sourceReferences"] = [];

    for (const item of events) {
      const ev = item.event;
      if (ev.event_name.startsWith("git.")) {
        gitActivity.push({
          sha: String(ev.attributes["sha"] || ""),
          author: String(ev.actor?.id || "unknown"),
          message: String(ev.attributes["message"] || ""),
          timestamp: ev.occurred_at || ev.observed_at
        });
      } else if (ev.event_name.startsWith("ci.")) {
        ciActivity.push({
          jobId: String(ev.attributes["job_id"] || ""),
          workflow: String(ev.attributes["workflow"] || ""),
          status: String(ev.attributes["status"] || ""),
          timestamp: ev.occurred_at || ev.observed_at
        });
      } else if (ev.event_name.startsWith("deployment.")) {
        deploymentActivity.push({
          deploymentId: String(ev.attributes["deployment_id"] || ""),
          environment: String(ev.attributes["environment"] || ""),
          status: String(ev.attributes["status"] || ""),
          timestamp: ev.occurred_at || ev.observed_at
        });
      }

      if (ev.evidence_refs) {
        for (const ref of ev.evidence_refs) {
          sourceReferences.push({
            eventId: ev.event_id,
            eventName: ev.event_name,
            locator: `${ref.locator_type}:${ref.locator}`
          });
        }
      }
    }

    // 9. Candidate Correlations
    const correlations = discoverCorrelations(events);

    // 11. Limitations & Caveats
    const limitations = [
      "EvidenceKit demonstrates post-capture integrity of stored records via SHA-256 hash chaining; it does not independently verify whether source systems provided truthful records.",
      "Candidate correlations are generated from deterministic rules and do not establish direct causality or root-cause without independent verification.",
      "Event timestamps reflect recorded source timestamps where provided, falling back to ingestion observed time."
    ];

    return {
      generatedAt: new Date().toISOString(),
      reportVersion: "1.0",
      summary: `Forensic reconstruction of incident '${incident.title}' containing ${events.length} captured events across ${artifacts.length} source artifacts with verification status: ${integrity.status.toUpperCase()}.`,
      metadata: {
        incidentId: incident.id,
        workspaceId: incident.workspaceId,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        environment: incident.environment,
        status: incident.status,
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt
      },
      sources: artifacts.map((a) => ({
        id: a.id,
        filename: a.filename,
        sha256: a.sha256,
        sizeBytes: a.size_bytes
      })),
      eventCounts: {
        total: events.length,
        bySeverity,
        bySystem
      },
      highlights: {
        firstEventAt: firstEvent?.event.occurred_at ?? null,
        lastEventAt: lastEvent?.event.occurred_at ?? null,
        durationMinutes,
        criticalEventsCount: (bySeverity["critical"] || 0) + (bySeverity["error"] || 0)
      },
      gitActivity,
      ciActivity,
      deploymentActivity,
      correlations,
      integrity,
      limitations,
      sourceReferences: sourceReferences.slice(0, 50)
    };
  }

  /**
   * Formats the structured report into publication-ready GitHub-flavored Markdown.
   */
  public reportToMarkdown(report: IncidentInvestigationReport): string {
    return `# Incident Investigation Report: ${report.metadata.title}

**Report Generated:** ${report.generatedAt}  
**Format Version:** ${report.reportVersion}  
**Integrity Status:** \`${report.integrity.status.toUpperCase()}\`  

---

## 1. Executive Summary
${report.summary}

---

## 2. Incident Metadata
- **Incident ID:** \`${report.metadata.incidentId}\`
- **Workspace:** \`${report.metadata.workspaceId}\`
- **Environment:** \`${report.metadata.environment}\`
- **Severity:** \`${report.metadata.severity.toUpperCase()}\`
- **Status:** \`${report.metadata.status.toUpperCase()}\`
- **Created At:** ${report.metadata.createdAt}
- **Last Updated:** ${report.metadata.updatedAt}
${report.metadata.description ? `\n**Description:**\n${report.metadata.description}\n` : ""}

---

## 3. Evidence Sources (${report.sources.length})
| Artifact Filename | SHA-256 Digest | Size |
|---|---|---|
${
  report.sources.length > 0
    ? report.sources
        .map((s) => `| \`${s.filename}\` | \`${s.sha256.slice(0, 16)}...\` | ${s.sizeBytes} B |`)
        .join("\n")
    : "| *No external artifacts stored* | - | - |"
}

---

## 4. Captured Event Distribution (${report.eventCounts.total} Total)
- **By Severity:** ${
      Object.entries(report.eventCounts.bySeverity)
        .map(([k, v]) => `\`${k}\`: ${v}`)
        .join(", ") || "None"
    }
- **By Source System:** ${
      Object.entries(report.eventCounts.bySystem)
        .map(([k, v]) => `\`${k}\`: ${v}`)
        .join(", ") || "None"
    }

---

## 5. Timeline Highlights
- **First Captured Event:** ${report.highlights.firstEventAt || "N/A"}
- **Last Captured Event:** ${report.highlights.lastEventAt || "N/A"}
- **Observed Span:** ${report.highlights.durationMinutes !== null ? `${report.highlights.durationMinutes} minutes` : "Instantaneous"}
- **Error/Critical Count:** ${report.highlights.criticalEventsCount}

---

## 6. Candidate Correlations (${report.correlations.length})
${
  report.correlations.length > 0
    ? report.correlations
        .map(
          (c) => `### [${c.rule_id}] ${c.rule_name} (Confidence: ${c.confidence.toUpperCase()})
- **Explanation:** ${c.explanation}
- **Matching Signals:** ${c.matching_signals.join(", ")}
- **Events:** \`${c.event_ids[0]}\` and \`${c.event_ids[1]}\`
- **Note:** *${c.caveat}*
`
        )
        .join("\n")
    : "No deterministic candidate correlations discovered."
}

---

## 7. Cryptographic Chain Verification
- **Verification Result:** \`${report.integrity.status.toUpperCase()}\`
- **Events Verified:** ${report.integrity.total_events}
- **Chain Head Hash:** \`${report.integrity.head_hash || "None"}\`

---

## 8. Investigation Limitations & Honest Claims
${report.limitations.map((l) => `- ${l}`).join("\n")}
`;
  }
}

export const defaultReportService = new ReportService();
