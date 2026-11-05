"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card } from "@evidencekit/ui";

interface IncidentSummary {
  id: string;
  streamId: string;
  title: string;
  description?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "open" | "investigating" | "mitigated" | "resolved" | "closed";
  environment: string;
  createdAt: string;
  updatedAt: string;
}

export default function TraceVaultHome() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadIncidents() {
      try {
        setLoading(true);
        const res = await fetch("/api/incidents?limit=10");
        if (!res.ok) throw new Error("Failed to load incidents");
        const data = await res.json();
        setIncidents(data.items || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadIncidents();
  }, []);

  const totalIncidents = incidents.length;
  const activeIncidents = incidents.filter(
    (i) => i.status === "open" || i.status === "investigating"
  ).length;
  const criticalIncidents = incidents.filter((i) => i.severity === "critical").length;

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="danger">Critical</Badge>;
      case "high":
        return <Badge variant="warning">High</Badge>;
      case "medium":
        return <Badge variant="default">Medium</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="danger">Open</Badge>;
      case "investigating":
        return <Badge variant="warning">Investigating</Badge>;
      case "mitigated":
        return <Badge variant="default">Mitigated</Badge>;
      case "resolved":
      case "closed":
        return <Badge variant="success">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Hero Banner */}
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-950/70 border border-blue-800/60 text-blue-400 text-xs font-medium">
            <span>🛡️ Software Incident Evidence Reconstruction</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Forensic Reconstruction Powered by EvidenceKit
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            TraceVault ingests heterogeneous incident sources, strips sensitive credentials before
            persistence, chains canonical normalized events via RFC 8785 + SHA-256, and produces
            tamper-evident audit trails.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/incidents/new">
            <Button variant="primary">Create Incident</Button>
          </Link>
          <Link href="/verify">
            <Button variant="outline">Verify Evidence Bundle</Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-zinc-900/50 border-zinc-800">
          <div className="text-xs font-medium text-zinc-400">Total Incidents</div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">
            {loading ? "..." : totalIncidents}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Recorded in workspace</div>
        </Card>
        <Card className="p-4 bg-zinc-900/50 border-zinc-800">
          <div className="text-xs font-medium text-zinc-400">Active Investigations</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {loading ? "..." : activeIncidents}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Requiring resolution</div>
        </Card>
        <Card className="p-4 bg-zinc-900/50 border-zinc-800">
          <div className="text-xs font-medium text-zinc-400">Critical Incidents</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            {loading ? "..." : criticalIncidents}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">High-impact events</div>
        </Card>
        <Card className="p-4 bg-zinc-900/50 border-zinc-800">
          <div className="text-xs font-medium text-zinc-400">Cryptographic Integrity</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">SHA-256</div>
          <div className="text-[11px] text-zinc-500 mt-1">RFC 8785 Canonical JCS</div>
        </Card>
      </div>

      {/* Recent Incidents Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-zinc-100">Recent Incidents</h2>
          <Link href="/incidents" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
            View all incidents →
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500 border border-zinc-800 rounded-lg bg-zinc-900/30">
            Loading incidents...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-rose-400 border border-rose-900/50 rounded-lg bg-rose-950/20">
            {error}
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center space-y-4 border border-zinc-800 rounded-lg bg-zinc-900/30">
            <p className="text-zinc-400 text-sm">No incidents registered in this workspace yet.</p>
            <Link href="/incidents/new">
              <Button variant="primary">Create First Incident</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="border-b border-zinc-800 bg-zinc-900/70 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Incident</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Environment</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans">
                {incidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/incidents/${incident.id}`}
                        className="font-medium text-zinc-100 hover:text-blue-400 transition-colors block"
                      >
                        {incident.title}
                      </Link>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {incident.streamId}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getSeverityBadge(incident.severity)}</td>
                    <td className="px-4 py-3">{getStatusBadge(incident.status)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded">
                        {incident.environment}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {new Date(incident.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/incidents/${incident.id}`}>
                        <Button variant="outline" size="sm">
                          Inspect
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
