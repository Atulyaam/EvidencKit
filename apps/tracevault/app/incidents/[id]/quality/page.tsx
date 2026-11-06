"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@evidencekit/ui";
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Download,
  Database,
  CheckCircle2,
  PieChart
} from "lucide-react";
import { EvidenceQualityReport } from "@evidencekit/core";

export default function IncidentQualityPage({ params }: { params: { id: string } }) {
  const [report, setReport] = useState<EvidenceQualityReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuality = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/incidents/${params.id}/quality`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuality();
  }, [params.id]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        Analyzing evidence quality and structural completeness...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        No quality report available for this incident stream.
      </div>
    );
  }

  const score = report.completenessScore;
  const scoreColor =
    score >= 90 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-red-400";
  const scoreBg = score >= 90 ? "bg-emerald-500" : score >= 70 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            Evidence Quality & Completeness Audit
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Deterministic evaluation of stream completeness, timestamp consistency, and source
            coverage.
          </p>
        </div>

        <a
          href={`/api/incidents/${params.id}/quality?format=markdown`}
          download={`evidence-quality-${params.id}.md`}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export Quality Report (.md)
        </a>
      </div>

      {/* Causality Disclaimer */}
      <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200/90 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-amber-300 font-semibold uppercase tracking-wider text-[11px] block">
            Forensic Notice: Completeness Assessment vs. Truthfulness
          </strong>
          <p className="text-[11px] leading-relaxed text-amber-200/80">{report.disclaimer}</p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completeness Score Card */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-400 font-mono">COMPLETENESS SCORE</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={`text-3xl font-extrabold ${scoreColor}`}>
              {score}
              <span className="text-sm font-normal text-zinc-500">/100</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className={`h-full ${scoreBg}`} style={{ width: `${score}%` }} />
            </div>
            <p className="text-[10px] text-zinc-500">
              Based on missing fields, clock skews, and hash integrity
            </p>
          </CardContent>
        </Card>

        {/* Total Events */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-400 font-mono">TOTAL ANALYZED</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-zinc-100">{report.totalEvents}</div>
            <p className="text-[11px] text-zinc-500 mt-2">Chained events in stream</p>
          </CardContent>
        </Card>

        {/* Detected Issues */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-400 font-mono">DETECTED ISSUES</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-extrabold text-zinc-100">{report.issueCount.total}</div>
            <div className="flex items-center gap-2 pt-1 text-[11px] font-mono">
              {report.issueCount.critical > 0 && (
                <span className="text-red-400">{report.issueCount.critical} Critical</span>
              )}
              {report.issueCount.warning > 0 && (
                <span className="text-amber-400">{report.issueCount.warning} Warning</span>
              )}
              <span className="text-blue-400">{report.issueCount.info} Info</span>
            </div>
          </CardContent>
        </Card>

        {/* Redacted Tokens */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-400 font-mono">SECRETS REDACTED</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-purple-400">{report.redactionCount}</div>
            <p className="text-[11px] text-zinc-500 mt-2">Tokens sanitized prior to hashing</p>
          </CardContent>
        </Card>
      </div>

      {/* Source Evidence Coverage */}
      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader className="pb-3 border-b border-zinc-800">
          <CardTitle className="text-sm font-bold text-zinc-200 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-cyan-400" />
            Source Evidence Coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {report.sourceCoverage.length === 0 ? (
            <p className="text-xs text-zinc-500">No source systems recorded.</p>
          ) : (
            <div className="divide-y divide-zinc-800/80">
              {report.sourceCoverage.map((cov) => (
                <div
                  key={cov.sourceSystem}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Database className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="font-mono text-zinc-200">{cov.sourceSystem}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-zinc-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                      <div className="h-full bg-cyan-500" style={{ width: `${cov.percentage}%` }} />
                    </div>
                    <span className="font-mono text-zinc-400 text-xs w-12 text-right">
                      {cov.percentage}%
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono w-16 text-right">
                      {cov.eventCount} ev
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detected Issues Details */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-purple-400" />
          Detailed Forensic Findings & Remediation Guidance ({report.issues.length})
        </h3>

        {report.issues.length === 0 ? (
          <div className="p-6 rounded-lg bg-zinc-900/40 border border-zinc-800 text-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-zinc-200">
              Zero structural or provenance defects detected
            </p>
            <p className="text-xs text-zinc-500">
              All events in stream contain valid source headers, timestamps, and continuous hash
              linkage.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {report.issues.map((iss) => {
              const isCrit = iss.severity === "critical";
              const isWarn = iss.severity === "warning";
              return (
                <div
                  key={iss.id}
                  className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                    isCrit
                      ? "bg-red-950/20 border-red-800/50 text-red-200"
                      : isWarn
                        ? "bg-amber-950/20 border-amber-800/50 text-amber-200"
                        : "bg-blue-950/20 border-blue-800/50 text-blue-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/40 pb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isCrit ? "danger" : isWarn ? "warning" : "default"}
                        className="text-[10px] uppercase font-mono px-2 py-0.5"
                      >
                        {iss.severity}
                      </Badge>
                      <span className="font-semibold text-zinc-100">{iss.message}</span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-400">
                      Rule: {iss.ruleCode}
                    </span>
                  </div>

                  <p className="text-zinc-300 text-xs leading-relaxed">{iss.explanation}</p>

                  {iss.eventIds.length > 0 && (
                    <div className="text-[11px] font-mono text-zinc-400 truncate">
                      Affected Event(s): {iss.eventIds.slice(0, 3).join(", ")}
                      {iss.eventIds.length > 3 ? ` (+${iss.eventIds.length - 3} more)` : ""}
                    </div>
                  )}

                  <div className="bg-zinc-950/70 p-2 rounded border border-zinc-800/60 text-[11px] text-zinc-300">
                    <strong className="text-emerald-400 font-mono">Suggested Remediation:</strong>{" "}
                    {iss.suggestedRemediation}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
