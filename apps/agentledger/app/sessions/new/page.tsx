"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, Button, Input } from "@evidencekit/ui";
import { ArrowLeft, Bot, Sparkles } from "lucide-react";

export default function NewSessionPage() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState("ws_demo_default");
  const [agentName, setAgentName] = useState("refactoring-assistant");
  const [goal, setGoal] = useState(
    "Refactor database query indexes and connection pool configuration"
  );
  const [environment, setEnvironment] = useState("staging");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (presetAgent: string, presetGoal: string) => {
    setAgentName(presetAgent);
    setGoal(presetGoal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/agentledger/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          agentName,
          goal,
          metadata: { environment }
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create session");
      }

      const created = await res.json();
      router.push(`/sessions/${created.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Sessions
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Create Agent Audit Session</h1>
        <p className="text-xs text-zinc-400">
          Initialize an instrumented session stream to record tool calls, approvals, and file
          mutations.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Preset Suggestions */}
      <Card className="bg-purple-950/20 border-purple-800/30">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Quick Workflow Presets
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                applyPreset(
                  "refactoring-assistant",
                  "Refactor legacy authentication middleware to use safe session headers"
                )
              }
              className="text-xs px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 hover:border-purple-500 text-zinc-300 transition-colors"
            >
              Auth Refactoring Agent
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset(
                  "security-auditor",
                  "Audit service configurations, optimize request timeouts, and enforce zero-trust policies"
                )
              }
              className="text-xs px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 hover:border-purple-500 text-zinc-300 transition-colors"
            >
              Security Policy Auditor
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset(
                  "dependency-updater",
                  "Automate dependency patch updates and verify before/after build hashes"
                )
              }
              className="text-xs px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 hover:border-purple-500 text-zinc-300 transition-colors"
            >
              Dependency Updater
            </button>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Workspace Identifier</label>
              <Input
                type="text"
                required
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="bg-zinc-950 border-zinc-700 font-mono text-xs"
              />
              <p className="text-[11px] text-zinc-500 font-mono">
                Boundary for multi-tenant isolation.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Agent Name / Model Identifier
              </label>
              <div className="relative">
                <Bot className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <Input
                  type="text"
                  required
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="pl-9 bg-zinc-950 border-zinc-700 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Primary Goal Statement</label>
              <textarea
                required
                rows={3}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-purple-500 font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Target Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-purple-500"
              >
                <option value="staging">Staging Sandbox</option>
                <option value="production">Production Workstation</option>
                <option value="local-dev">Local Development Environment</option>
              </select>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <Link href="/sessions">
                <Button variant="ghost" className="text-xs text-zinc-400">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-9 px-4"
              >
                {loading ? "Creating Stream..." : "Create Audit Session"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
