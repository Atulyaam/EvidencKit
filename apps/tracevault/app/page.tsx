"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  LoadingState,
  EmptyState,
  ErrorState
} from "@evidencekit/ui";
import {
  ShieldAlert,
  ShieldCheck,
  PlusCircle,
  FileSearch,
  Share2,
  Clock,
  Layers,
  ArrowRight,
  Database
} from "lucide-react";

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-950 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/70 border border-blue-800/60 text-blue-400 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>🛡️ Software Incident Evidence Reconstruction</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white text-balance">
              Forensic Reconstruction Powered by EvidenceKit
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl text-balance">
              TraceVault ingests heterogeneous incident sources, strips sensitive credentials before
              persistence, chains canonical normalized events via RFC 8785 + SHA-256, and produces
              tamper-evident audit trails.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Link href="/incidents/new" className="w-full sm:w-auto">
              <Button variant="primary" className="w-full sm:w-auto gap-2">
                <PlusCircle className="w-4 h-4" />
                <span>Create Incident</span>
              </Button>
            </Link>
            <Link href="/verify" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto gap-2">
                <FileSearch className="w-4 h-4" />
                <span>Verify Evidence Bundle</span>
              </Button>
            </Link>
            <Link href="/graph" className="w-full sm:w-auto">
              <Button variant="ghost" className="w-full sm:w-auto gap-2 text-zinc-300">
                <Share2 className="w-4 h-4" />
                <span>Evidence Graph</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-zinc-900/60 border-zinc-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            <span>Total Incidents</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-2 font-mono">
            {loading ? "..." : totalIncidents}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Recorded in workspace</div>
        </Card>

        <Card className="p-4 bg-zinc-900/60 border-zinc-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            <span>Active Investigations</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2 font-mono">
            {loading ? "..." : activeIncidents}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Requiring resolution</div>
        </Card>

        <Card className="p-4 bg-zinc-900/60 border-zinc-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            <span>Critical Incidents</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2 font-mono">
            {loading ? "..." : criticalIncidents}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">High-impact events</div>
        </Card>

        <Card className="p-4 bg-zinc-900/60 border-zinc-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            <span>Cryptographic Integrity</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono">SHA-256</div>
          <div className="text-[11px] text-zinc-500 mt-1">RFC 8785 Canonical JCS</div>
        </Card>
      </div>

      {/* Recent Incidents Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              Recent Incidents
            </h2>
            <p className="text-xs text-zinc-400">
              Isolated incident reconstruction streams backed by immutable event hash chains.
            </p>
          </div>
          <Link
            href="/incidents"
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            <span>View all incidents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <LoadingState
            message="Loading incidents..."
            description="Retrieving incident records from workspace..."
          />
        ) : error ? (
          <ErrorState
            title="Failed to Load Incidents"
            error={error}
            onRetry={() => window.location.reload()}
          />
        ) : incidents.length === 0 ? (
          <EmptyState
            title="No Incidents Registered"
            description="No incident streams exist in this workspace. Create your first incident to begin forensic evidence ingestion."
            action={
              <Link href="/incidents/new">
                <Button variant="primary">Create First Incident</Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id} isClickable>
                  <TableCell>
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="font-medium text-zinc-100 hover:text-blue-400 transition-colors block"
                    >
                      {incident.title}
                    </Link>
                    <span className="text-[11px] font-mono text-zinc-500">{incident.streamId}</span>
                  </TableCell>
                  <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                  <TableCell>{getStatusBadge(incident.status)}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                      {incident.environment}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-400 font-mono">
                    {new Date(incident.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/incidents/${incident.id}`}>
                      <Button variant="outline" size="sm">
                        Inspect
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
