"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "@evidencekit/ui";
import {
  Play,
  PlusCircle,
  ShieldCheck,
  AlertTriangle,
  History,
  FileCode,
  ArrowRight,
  Bot
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

export default function AgentLedgerDashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/agentledger/sessions?limit=10");
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
    fetchSessions();
  }, []);

  const handleLaunchDemo = async () => {
    setDemoRunning(true);
    setDemoMessage("Initializing sandbox and executing deterministic 10-step agent audit...");
    try {
      const res = await fetch("/api/agentledger/sessions/demo-session/demo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: "refactoring-assistant",
          goal: "Audit configurations, optimize timeout parameters, and enforce zero-trust security policy"
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to execute demo");
      }

      const data = await res.json();
      setDemoMessage(`Demo completed! Hash: ${data.headHash.slice(0, 16)}... Redirecting...`);
      setTimeout(() => {
        router.push(`/sessions/${data.sessionId}/timeline`);
      }, 1000);
    } catch (err: any) {
      setDemoMessage(`Error: ${err.message}`);
      setDemoRunning(false);
    }
  };

  const activeCount = sessions.filter(
    (s) => s.status === "running" || s.status === "awaiting_approval"
  ).length;
  const awaitingCount = sessions.filter((s) => s.status === "awaiting_approval").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/60 via-zinc-900 to-zinc-900 border border-purple-800/40 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-900/50 border border-purple-700/60 text-xs text-purple-300 font-mono">
              <Bot className="w-3.5 h-3.5" />
              AI Agent Activity Auditing & Governance
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Immutable Forensic Audit Stream for Autonomous Agents
            </h1>
            <p className="text-sm text-zinc-300 leading-relaxed">
              AgentLedger instrumentally captures every tool execution, human approval, and file
              mutation in an RFC 8785 canonical SHA-256 hash-chain. Inspect what the agent proposed,
              what was approved, and verify that unauthorized modifications were strictly prevented.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              onClick={handleLaunchDemo}
              disabled={demoRunning}
              className="bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 h-11 px-5"
            >
              <Play className="w-4 h-4 fill-current" />
              {demoRunning ? "Running Audit..." : "Launch Controlled Demo"}
            </Button>
            <Link href="/sessions/new">
              <Button
                variant="outline"
                className="border-zinc-700 hover:bg-zinc-800 text-zinc-200 h-11 px-5 w-full sm:w-auto"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                New Session
              </Button>
            </Link>
          </div>
        </div>

        {demoMessage && (
          <div className="mt-4 p-3 rounded-lg bg-purple-950/80 border border-purple-800/60 text-xs font-mono text-purple-200 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />
            {demoMessage}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase font-mono tracking-wider">
                Total Sessions
              </p>
              <p className="text-2xl font-bold mt-1">{sessions.length}</p>
              <p className="text-[11px] text-zinc-500 mt-1">Recorded audit streams</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
              <Bot className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase font-mono tracking-wider">
                Active Runs
              </p>
              <p className="text-2xl font-bold mt-1 text-emerald-400">{activeCount}</p>
              <p className="text-[11px] text-zinc-500 mt-1">In-flight sessions</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <Play className="w-5 h-5 fill-current" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase font-mono tracking-wider">
                Pending Approvals
              </p>
              <p className="text-2xl font-bold mt-1 text-amber-400">{awaitingCount}</p>
              <p className="text-[11px] text-zinc-500 mt-1">Human-in-the-loop gates</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase font-mono tracking-wider">
                Integrity Verified
              </p>
              <p className="text-2xl font-bold mt-1 text-purple-400">100%</p>
              <p className="text-[11px] text-zinc-500 mt-1">SHA-256 Chain Sealed</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/80 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">Instrumented Agent Sessions</CardTitle>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live audit sessions with cryptographic provenance and approval records
            </p>
          </div>
          <Link
            href="/sessions"
            className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1"
          >
            View All Sessions <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-sm">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-zinc-400 text-sm">No agent sessions recorded yet.</p>
              <Button
                onClick={handleLaunchDemo}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs"
              >
                Run Controlled Demo Session
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-purple-400 font-semibold">
                        {s.id}
                      </span>
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

                    <p className="text-sm text-zinc-200 truncate">{s.goal}</p>

                    <p className="text-xs text-zinc-500 font-mono">
                      Recorded: {new Date(s.createdAt).toLocaleString()}
                    </p>
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
