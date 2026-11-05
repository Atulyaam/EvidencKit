"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@evidencekit/ui";
import { IncidentInvestigationReport } from "@evidencekit/evidence-server";

interface ReportPageProps {
  params?: { id: string };
}

export default function IncidentReportPage({ params }: ReportPageProps) {
  const routeParams = useParams();
  const incidentId = (routeParams?.id as string) || params?.id || "";

  const [report, setReport] = useState<IncidentInvestigationReport | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [viewMode, setViewMode] = useState<"rendered" | "markdown">("rendered");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);

        const [jsonRes, mdRes] = await Promise.all([
          fetch(`/api/incidents/${incidentId}/report?format=json`),
          fetch(`/api/incidents/${incidentId}/report?format=markdown`)
        ]);

        if (!jsonRes.ok) throw new Error("Failed to generate incident report");
        const jsonData = await jsonRes.json();
        setReport(jsonData);

        if (mdRes.ok) {
          const mdText = await mdRes.text();
          setMarkdown(mdText);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [incidentId]);

  const handleDownloadMarkdown = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident-${incidentId}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident-${incidentId}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-zinc-500 border border-zinc-800 rounded-lg bg-zinc-900/30">
        Generating deterministic 12-section reconstruction report...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 text-center text-sm text-rose-400 border border-rose-900/50 rounded-lg bg-rose-950/20">
        {error || "Report unavailable"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div>
          <h3 className="text-base font-bold text-white">Deterministic Investigation Report</h3>
          <p className="text-xs text-zinc-400">
            Updated at {new Date(report.metadata.updatedAt).toLocaleString()} • 12 Structured
            Forensic Sections
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md bg-zinc-800 p-0.5 border border-zinc-700 text-xs">
            <button
              onClick={() => setViewMode("rendered")}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                viewMode === "rendered"
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Formatted View
            </button>
            <button
              onClick={() => setViewMode("markdown")}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                viewMode === "markdown"
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Markdown Source
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
            Download .md
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadJson}>
            Download .json
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {viewMode === "markdown" ? (
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardContent className="p-4">
            <pre className="overflow-x-auto font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {markdown}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Section 1 & 2: Metadata & Executive Summary */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-zinc-100">{report.metadata.title}</CardTitle>
                <Badge variant={report.integrity.status === "verified" ? "success" : "danger"}>
                  Chain: {report.integrity.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Executive Summary
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{report.summary}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-zinc-800 text-xs">
                <div>
                  <span className="text-zinc-500 block">Severity:</span>
                  <span className="text-zinc-200 font-semibold uppercase">
                    {report.metadata.severity}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Status:</span>
                  <span className="text-zinc-200 font-semibold uppercase">
                    {report.metadata.status}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Environment:</span>
                  <span className="text-zinc-200 font-mono">{report.metadata.environment}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Total Events:</span>
                  <span className="text-blue-400 font-mono font-bold">
                    {report.eventCounts.total}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Evidence Integrity Audit */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <CardTitle className="text-base text-zinc-100">Evidence Integrity Audit</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row justify-between gap-2 p-3 rounded-md bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-400">Canonicalization Standard:</span>
                <span className="text-emerald-400 font-mono font-semibold">RFC 8785 (JCS)</span>
              </div>
              <div className="flex flex-col sm:flex-row justify-between gap-2 p-3 rounded-md bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-400">Chain Head Hash:</span>
                <span className="text-blue-400 font-mono break-all">
                  {report.integrity.head_hash || "N/A"}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row justify-between gap-2 p-3 rounded-md bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-400">Verification Verdict:</span>
                <span className="text-emerald-400 font-semibold">
                  {report.integrity.status === "verified"
                    ? "PASS (100% Cryptographically Continuous)"
                    : "FAIL"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Candidate Correlations */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <CardTitle className="text-base text-zinc-100">
                Candidate Event Correlations ({report.correlations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {report.correlations.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No candidate correlations identified in this dataset.
                </p>
              ) : (
                report.correlations.map((cor, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-amber-900/40 bg-amber-950/20 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400">{cor.rule_id}</span>
                      <span className="text-zinc-400 font-mono uppercase">
                        Confidence: {cor.confidence}
                      </span>
                    </div>
                    <div className="text-zinc-200 font-medium">{cor.rule_name}</div>
                    <p className="text-zinc-300 text-[11px]">{cor.explanation}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Section 11: Limitations */}
          {report.limitations.length > 0 && (
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-3 border-b border-zinc-800/80">
                <CardTitle className="text-base text-zinc-100">
                  Investigation Limitations & Caveats
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2 text-xs text-zinc-400">
                <ul className="list-disc pl-5 space-y-1">
                  {report.limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
