"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  LoadingState,
  EmptyState,
  ErrorState,
  Breadcrumbs,
  BreadcrumbItem
} from "@evidencekit/ui";
import { PlusCircle, Search, Filter, RotateCcw, ShieldAlert } from "lucide-react";

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs>
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Incidents Directory</BreadcrumbItem>
      </Breadcrumbs>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-blue-500" />
            Incidents Directory
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage, filter, and reconstruct incident evidence records across environments.
          </p>
        </div>
        <Link href="/incidents/new">
          <Button variant="primary" className="gap-2">
            <PlusCircle className="w-4 h-4" />
            <span>+ Create Incident</span>
          </Button>
        </Link>
      </div>

      {/* Search and Filters Bar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search by title, description, or stream ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-zinc-500" />}
            />
          </div>
          <Button type="submit" variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            <span>Search</span>
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-zinc-800/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-medium">Severity:</span>
            <select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setOffset(0);
              }}
              className="bg-zinc-900 border border-zinc-700/80 rounded-md px-2.5 py-1 text-zinc-200 text-xs outline-none focus:border-blue-500 transition-colors"
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
            <span className="text-zinc-400 font-medium">Status:</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
              className="bg-zinc-900 border border-zinc-700/80 rounded-md px-2.5 py-1 text-zinc-200 text-xs outline-none focus:border-blue-500 transition-colors"
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
            <span className="text-zinc-400 font-medium">Environment:</span>
            <select
              value={environment}
              onChange={(e) => {
                setEnvironment(e.target.value);
                setOffset(0);
              }}
              className="bg-zinc-900 border border-zinc-700/80 rounded-md px-2.5 py-1 text-zinc-200 text-xs outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">All Environments</option>
              <option value="production">production</option>
              <option value="staging">staging</option>
              <option value="development">development</option>
            </select>
          </div>

          {(search || severity || status || environment) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSeverity("");
                setStatus("");
                setEnvironment("");
                setOffset(0);
              }}
              className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 underline ml-auto transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Incidents Table */}
      {loading ? (
        <LoadingState
          message="Loading incidents..."
          description="Filtering and querying incident streams..."
        />
      ) : error ? (
        <ErrorState title="Failed to Load Incidents" error={error} onRetry={fetchIncidents} />
      ) : incidents.length === 0 ? (
        <EmptyState
          title="No Matching Incidents Found"
          description="No incidents matched your query. Try broadening your search or resetting filters."
          action={
            <Link href="/incidents/new">
              <Button variant="primary">Create New Incident</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Last Updated</TableHead>
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
                    {new Date(incident.updatedAt || incident.createdAt).toLocaleDateString()}
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

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 gap-3 pt-2">
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
