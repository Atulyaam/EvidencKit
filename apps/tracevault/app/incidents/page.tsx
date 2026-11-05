"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Input } from "@evidencekit/ui";

interface Incident {
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

export default function IncidentsDirectoryPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [environment, setEnvironment] = useState<string>("");

  // Pagination
  const [total, setTotal] = useState(0);
  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (severity) params.set("severity", severity);
      if (status) params.set("status", status);
      if (environment) params.set("environment", environment);
      params.set("limit", limit.toString());
      params.set("offset", offset.toString());

      const res = await fetch(`/api/incidents?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch incidents");
      }
      const data = await res.json();
      setIncidents(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [severity, status, environment, offset]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchIncidents();
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "critical":
        return <Badge variant="danger">Critical</Badge>;
      case "high":
        return <Badge variant="warning">High</Badge>;
      case "medium":
        return <Badge variant="default">Medium</Badge>;
      default:
        return <Badge variant="outline">{sev}</Badge>;
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "open":
        return <Badge variant="danger">Open</Badge>;
      case "investigating":
        return <Badge variant="warning">Investigating</Badge>;
      case "mitigated":
        return <Badge variant="default">Mitigated</Badge>;
      case "resolved":
      case "closed":
        return <Badge variant="success">{st}</Badge>;
      default:
        return <Badge variant="outline">{st}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Incidents Directory</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage and reconstruct incident evidence records across environments.
          </p>
        </div>
        <Link href="/incidents/new">
          <Button variant="primary">+ Create Incident</Button>
        </Link>
      </div>

      {/* Search and Filters Bar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search by title, description, or stream ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Severity:</span>
            <select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setOffset(0);
              }}
              className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-zinc-200 outline-none focus:border-blue-500"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Status:</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
              className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-zinc-200 outline-none focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="mitigated">Mitigated</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Environment:</span>
            <select
              value={environment}
              onChange={(e) => {
                setEnvironment(e.target.value);
                setOffset(0);
              }}
              className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-zinc-200 outline-none focus:border-blue-500"
            >
              <option value="">All Environments</option>
              <option value="production">production</option>
              <option value="staging">staging</option>
              <option value="development">development</option>
            </select>
          </div>

          {(search || severity || status || environment) && (
            <button
              onClick={() => {
                setSearch("");
                setSeverity("");
                setStatus("");
                setEnvironment("");
                setOffset(0);
              }}
              className="text-xs text-rose-400 hover:text-rose-300 underline ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Incidents Table */}
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
          <p className="text-zinc-400 text-sm">No incidents match your query.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="border-b border-zinc-800 bg-zinc-900/70 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Incident</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Environment</th>
                  <th className="px-4 py-3">Last Updated</th>
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
                      {new Date(incident.updatedAt || incident.createdAt).toLocaleDateString()}
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

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-zinc-400 pt-2">
            <div>
              Showing <span className="font-semibold text-zinc-200">{offset + 1}</span> to{" "}
              <span className="font-semibold text-zinc-200">{Math.min(offset + limit, total)}</span>{" "}
              of <span className="font-semibold text-zinc-200">{total}</span> incidents
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
