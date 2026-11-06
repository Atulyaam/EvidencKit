import {
  ChainedEvent,
  EvidenceQualityReport,
  analyzeEvidenceQuality
} from "@evidencekit/core";
import { DbClient } from "@evidencekit/db";
import { defaultChainService } from "./chain-service";

export class EvidenceQualityService {
  /**
   * Generates a deterministic quality report for an incident or agent session evidence stream.
   */
  public async getQualityReport(
    streamId: string,
    db?: DbClient
  ): Promise<EvidenceQualityReport> {
    let events: ChainedEvent[] = [];
    if (db) {
      try {
        events = await defaultChainService.getEventsFromDb(streamId, db);
      } catch {
        events = defaultChainService.getEventsInMemory(streamId);
      }
    } else {
      events = defaultChainService.getEventsInMemory(streamId);
    }

    return analyzeEvidenceQuality(streamId, events);
  }

  /**
   * Generates exportable Markdown quality audit report.
   */
  public generateMarkdownQualityReport(report: EvidenceQualityReport): string {
    const lines: string[] = [];

    lines.push(`# Evidence Quality & Completeness Report`);
    lines.push(`**Stream ID:** \`${report.streamId}\``);
    lines.push(`**Analyzed At:** ${report.analyzedAt}`);
    lines.push(`**Completeness Score:** ${report.completenessScore}/100`);
    lines.push(`**Total Events Analyzed:** ${report.totalEvents}`);
    lines.push(
      `**Issues Detected:** ${report.issueCount.total} (${report.issueCount.critical} Critical, ${report.issueCount.warning} Warning, ${report.issueCount.info} Info)`
    );
    lines.push(`**Redacted Sensitive Tokens:** ${report.redactionCount}`);
    lines.push("");

    lines.push(`> [!IMPORTANT]`);
    lines.push(`> ${report.disclaimer}`);
    lines.push("");

    lines.push(`## Source Evidence Coverage`);
    if (report.sourceCoverage.length === 0) {
      lines.push("_No source systems recorded in stream._");
    } else {
      lines.push(`| Source System | Event Count | Coverage % |`);
      lines.push(`| :--- | :---: | :---: |`);
      for (const cov of report.sourceCoverage) {
        lines.push(`| \`${cov.sourceSystem}\` | ${cov.eventCount} | ${cov.percentage}% |`);
      }
    }
    lines.push("");

    lines.push(`## Detected Quality Issues & Remediation Guidance`);
    if (report.issues.length === 0) {
      lines.push("✓ **Zero structural or provenance defects detected in stream.**");
    } else {
      for (const iss of report.issues) {
        const icon =
          iss.severity === "critical" ? "🔴" : iss.severity === "warning" ? "🟡" : "ℹ️";
        lines.push(`### ${icon} ${iss.message}`);
        lines.push(`- **Rule Code:** \`${iss.ruleCode}\``);
        lines.push(`- **Severity:** \`${iss.severity.toUpperCase()}\``);
        lines.push(`- **Explanation:** ${iss.explanation}`);
        if (iss.eventIds.length > 0) {
          lines.push(`- **Affected Event IDs:** \`${iss.eventIds.slice(0, 5).join("`, `")}\``);
        }
        lines.push(`- **Recommended Action:** ${iss.suggestedRemediation}`);
        lines.push("");
      }
    }

    return lines.join("\n");
  }
}

export const defaultEvidenceQualityService = new EvidenceQualityService();

