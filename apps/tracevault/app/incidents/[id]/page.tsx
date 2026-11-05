"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@evidencekit/ui";
import { CandidateCorrelation } from "@evidencekit/core";

interface IncidentOverviewProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function IncidentOverviewPage({ params }: IncidentOverviewProps) {
  const resolvedParams = "then" in params ? use(params) : params;
  const incidentId = resolvedParams.id;

  const [incident, setIncident] = useState<any>(null);
  const [correlations, setCorrelations] = useState<CandidateCorrelation[]>([]);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [incRes, corRes, timeRes] = await Promise.all([
          fetch(`/api/incidents/${incidentId}`),
          fetch(`/api/incidents/${incidentId}/correlations`),
          fetch(`/api/incidents/${incidentId}/timeline?limit=5`)
        ]);

        if (incRes.ok) setIncident(await incRes.json());
        if (corRes.ok) {
          const cData = await corRes.json();
          setCorrelations(cData.correlations || []);
        }
        if (timeRes.ok) setTimelineData(await timeRes.json());
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [incidentId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-zinc-500 border border-zinc-800 rounded-lg bg-zinc-900/30">
        Loading incident reconstruction overview...
      </div>
    );
  }

  const totalEvents = timelineData?.total || 0;

  return (
    <div className="space-y-6">
      {/* Description & Overview Card */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <CardTitle className="text-base text-zinc-100">Incident Summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            {incident?.description || "No detailed description provided for this incident."}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-zinc-800/80 text-xs">
            <div>
              <span className="text-zinc-500 block">Created At:</span>
              <span className="text-zinc-200 font-mono">
                {incident?.createdAt ? new Date(incident.createdAt).toLocaleString() : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Target Environment:</span>
              <span className="text-zinc-200 font-mono">
                {incident?.environment || "production"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Total Chained Events:</span>
              <span className="text-blue-400 font-bold font-mono">{totalEvents}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Candidate Correlations:</span>
              <span className="text-amber-400 font-bold font-mono">{correlations.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Action Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href={`/incidents/${incidentId}/evidence`} className="group">
          <Card className="p-4 border-zinc-800 bg-zinc-900/40 group-hover:border-blue-500/50 transition-colors h-full">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-blue-950/60 text-blue-400 border border-blue-800/40 text-lg">
                📥
              </span>
              <div>
                <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors">
                  Ingest Evidence Sources
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Upload JSONL, Git, CI, Deployment logs, or ZIP bundles
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href={`/incidents/${incidentId}/timeline`} className="group">
          <Card className="p-4 border-zinc-800 bg-zinc-900/40 group-hover:border-blue-500/50 transition-colors h-full">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-lg">
                ⏱️
              </span>
              <div>
                <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                  Forensic Timeline
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Explore chronological events and provenance locators
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href={`/incidents/${incidentId}/report`} className="group">
          <Card className="p-4 border-zinc-800 bg-zinc-900/40 group-hover:border-blue-500/50 transition-colors h-full">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-purple-950/60 text-purple-400 border border-purple-800/40 text-lg">
                📄
              </span>
              <div>
                <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-purple-400 transition-colors">
                  Investigation Report
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Generate 12-section reconstruction report & export Markdown
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Candidate Correlations Section */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3 border-b border-zinc-800/80 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base text-zinc-100">
              Discovered Candidate Correlations
            </CardTitle>
            <p className="text-xs text-zinc-500 mt-0.5">
              Deterministic cross-system pattern matching (Rules TV-COR-001 through TV-COR-005)
            </p>
          </div>
          <Badge variant="warning">{correlations.length} Candidate(s)</Badge>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {correlations.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
              No candidate correlations discovered yet. Ingest more multi-source evidence (e.g. CI
              failures, Git commits, application logs) to discover patterns.
            </div>
          ) : (
            <div className="space-y-3">
              {correlations.map((cor, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">{cor.rule_id}</span>
                      <span className="font-semibold text-zinc-200">{cor.rule_name}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 font-mono text-[11px] uppercase">
                      Confidence: {cor.confidence}
                    </span>
                  </div>
                  <p className="text-zinc-300">{cor.explanation}</p>
                  <div className="pt-2 border-t border-amber-900/30 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                    <span>Source: {cor.event_ids[0].slice(0, 8)}...</span>
                    <span>→</span>
                    <span>Target: {cor.event_ids[1].slice(0, 8)}...</span>
                  </div>
                </div>
              ))}

              <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-[11px] text-zinc-400">
                ⚠️{" "}
                <span className="font-semibold text-zinc-300">
                  Deterministic Evidence Disclaimer:
                </span>{" "}
                Correlations are candidate patterns derived from temporal proximity, deployment
                transitions, or shared correlation identifiers. They do not constitute definitive
                proof of root cause.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
