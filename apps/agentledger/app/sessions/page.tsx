"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  Badge,
  Button,
  Input
} from "@evidencekit/ui";
import {
  PlusCircle,
  Search,
  Filter,
  Bot,
  History,
  Play,
  AlertTriangle,
  FileCode,
  ArrowRight
} from "lucide-react";

interface SessionSummary {
  id: string;
  workspaceId: string;
  agentName: string;
  goal: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function SessionsListPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/agentledger/sessions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadSessions();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Audit Sessions</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Browse and inspect all recorded AI-agent workflows and cryptographic chains
          </p>
        </div>

        <Link href="/sessions/new">
          <Button className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-9">
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            New Agent Session
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search by goal, agent name, or session ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-zinc-950 border-zinc-700 text-xs w-full"
            />
          </form>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-zinc-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 text-zinc-300 text-xs rounded-md h-9 px-3 outline-none focus:border-purple-500 w-full sm:w-44"
            >
              <option value="all">All Statuses</option>
              <option value="created">Created</option>
              <option value="running">Running</option>
              <option value="awaiting_approval">Awaiting Approval</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <Button
              variant="outline"
              onClick={loadSessions}
              className="h-9 text-xs border-zinc-700 hover:bg-zinc-800"
            >
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Grid / List */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-sm">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-zinc-400 text-sm">No agent sessions matched your filter criteria.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="text-xs border-zinc-700 text-zinc-300"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Bot className="w-4 h-4 text-purple-400" />
                      <span className="font-mono text-xs text-purple-400 font-semibold">{s.id}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-xs font-medium text-zinc-300">{s.agentName}</span>
                      <Badge
                        variant={
                          s.status === "completed"
                            ? "success"
                            : s.status === "running"
                            ? "default"
                            : s.status === "awaiting_approval"
                            ? "warning"
                            : "outline"
                        }
                        className="text-[10px] uppercase font-mono px-2 py-0.5"
                      >
                        {s.status.replace("_", " ")}
                      </Badge>
                    </div>

                    <p className="text-sm text-zinc-200">{s.goal}</p>

                    <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
                      <span>Workspace: {s.workspaceId}</span>
                      <span>•</span>
                      <span>Recorded: {new Date(s.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
                    <Link href={`/sessions/${s.id}/timeline`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                      >
                        <History className="w-3.5 h-3.5 mr-1 text-purple-400" />
                        Timeline
                      </Button>
                    </Link>
                    <Link href={`/sessions/${s.id}/replay`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                      >
                        <Play className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                        Replay
                      </Button>
                    </Link>
                    <Link href={`/sessions/${s.id}/approvals`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-400" />
                        Approvals
                      </Button>
                    </Link>
                    <Link href={`/sessions/${s.id}/files`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                      >
                        <FileCode className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                        Files
                      </Button>
                    </Link>
                    <Link href={`/sessions/${s.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-zinc-400 hover:text-white"
                      >
                        Overview <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
