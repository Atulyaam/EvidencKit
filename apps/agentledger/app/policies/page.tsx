"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Input
} from "@evidencekit/ui";
import {
  ShieldCheck,
  Play,
  History,
  FileCode,
  Info
} from "lucide-react";
import { AgentPolicy, PolicyEvaluationResult } from "@evidencekit/core";

export default function PoliciesPage() {
  const [activePolicy, setActivePolicy] = useState<AgentPolicy | null>(null);
  const [policyHistory, setPolicyHistory] = useState<AgentPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulator state
  const [simTool, setSimTool] = useState("modify_file");
  const [simPath, setSimPath] = useState("src/protected-config.ts");
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<PolicyEvaluationResult | null>(null);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/agentledger/policies");
      if (res.ok) {
        const data = await res.json();
        setActivePolicy(data.active);
        setPolicyHistory(data.history || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleSimulate = async () => {
    setSimLoading(true);
    try {
      const res = await fetch("/api/agentledger/policies/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: simTool,
          path: simPath
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult(data.simulation);
      }
    } catch {
      // ignore
    } finally {
      setSimLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center text-sm text-zinc-500">
        Loading Agent Governance Policies...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-purple-400" />
              Policy Intelligence Engine
            </h1>
            <Badge variant="outline" className="text-purple-300 font-mono text-xs">
              Version {activePolicy?.version || "1.0.0"}
            </Badge>
          </div>
          <p className="text-sm text-zinc-400">
            Deterministic, server-enforced governance policies regulating autonomous AI agent tool executions and resource access.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-zinc-500">Default Decision:</span>
          <Badge
            variant={
              activePolicy?.defaultDecision === "ALLOW"
                ? "success"
                : activePolicy?.defaultDecision === "DENY"
                  ? "danger"
                  : "warning"
            }
            className="text-[11px] uppercase font-bold"
          >
            {activePolicy?.defaultDecision}
          </Badge>
        </div>
      </div>

      {/* Simulator Section */}
      <Card className="border-purple-800/40 bg-purple-950/10">
        <CardHeader className="pb-3 border-b border-purple-900/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-purple-200 flex items-center gap-2">
              <Play className="w-4 h-4 text-purple-400" />
              Live Policy Simulator
            </CardTitle>
            <span className="text-[11px] text-purple-300/80 font-mono">
              Hypothetical testing • Zero filesystem execution
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Target Tool
              </label>
              <select
                value={simTool}
                onChange={(e) => setSimTool(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
              >
                <option value="read_file">read_file (Allowlisted)</option>
                <option value="list_files">list_files (Allowlisted)</option>
                <option value="calculate_file_hash">calculate_file_hash (Allowlisted)</option>
                <option value="modify_file">modify_file (Allowlisted)</option>
                <option value="create_file">create_file (Allowlisted)</option>
                <option value="shell_command">shell_command (Prohibited Shell Tool)</option>
                <option value="exec">exec (Direct Exec)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Resource / Target Path
              </label>
              <div className="flex gap-2">
                <Input
                  value={simPath}
                  onChange={(e) => setSimPath(e.target.value)}
                  placeholder="e.g. src/protected-config.ts or .env.production"
                  className="font-mono text-xs bg-zinc-900 border-zinc-700 text-zinc-100 flex-1"
                />
                <Button
                  onClick={handleSimulate}
                  disabled={simLoading}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs whitespace-nowrap h-9 px-4 font-semibold"
                >
                  {simLoading ? "Evaluating..." : "Simulate Decision"}
                </Button>
              </div>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-zinc-400">
            <span className="font-semibold text-zinc-500">Preset Scenarios:</span>
            <button
              onClick={() => {
                setSimTool("read_file");
                setSimPath("src/config.ts");
              }}
              className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
            >
              Safe Read (ALLOW)
            </button>
            <button
              onClick={() => {
                setSimTool("modify_file");
                setSimPath("src/protected-config.ts");
              }}
              className="px-2 py-0.5 rounded bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 border border-amber-800/60"
            >
              Protected Config Edit (REQUIRE_APPROVAL)
            </button>
            <button
              onClick={() => {
                setSimTool("modify_file");
                setSimPath(".env.production");
              }}
              className="px-2 py-0.5 rounded bg-red-950/40 hover:bg-red-900/40 text-red-300 border border-red-800/60"
            >
              Secret File Access (DENY)
            </button>
            <button
              onClick={() => {
                setSimTool("shell_command");
                setSimPath("");
              }}
              className="px-2 py-0.5 rounded bg-red-950/40 hover:bg-red-900/40 text-red-300 border border-red-800/60"
            >
              Arbitrary Shell (DENY)
            </button>
          </div>

          {/* Simulation Output Display */}
          {simResult && (
            <div className="mt-4 p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-zinc-400 font-mono">Decision:</span>
                  <Badge
                    variant={
                      simResult.decision === "ALLOW"
                        ? "success"
                        : simResult.decision === "DENY"
                          ? "danger"
                          : "warning"
                    }
                    className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5"
                  >
                    {simResult.decision}
                  </Badge>
                  <span className="text-zinc-600">•</span>
                  <span className="text-xs text-zinc-300 font-medium">
                    {simResult.matchedRuleName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                  <span>Rule: {simResult.matchedRuleId}</span>
                  <span>•</span>
                  <span>Risk: {simResult.riskLevel}</span>
                </div>
              </div>

              <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-2.5 rounded border border-zinc-800/80">
                <strong className="text-purple-300">Explainable Reason:</strong>{" "}
                {simResult.reason}
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-purple-400" />
                  Approval Required: {simResult.approvalRequired ? "YES (Enforced on Server)" : "NO"}
                </span>
                <span className="font-mono text-zinc-600">
                  Evaluated at: {new Date(simResult.evaluatedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Rules Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <FileCode className="w-5 h-5 text-purple-400" />
            Active Policy Rules ({activePolicy?.rules.length || 0})
          </h2>
          <span className="text-xs text-zinc-500">
            Evaluated in precedence order (Lowest index first)
          </span>
        </div>

        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/40 divide-y divide-zinc-800/70">
          {activePolicy?.rules.map((rule) => {
            const isDeny = rule.action === "DENY";
            const isApproval = rule.action === "REQUIRE_APPROVAL";
            return (
              <div
                key={rule.id}
                className="p-4 hover:bg-zinc-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-zinc-500">
                      #{rule.precedence}
                    </span>
                    <span className="text-sm font-semibold text-zinc-200">
                      {rule.name}
                    </span>
                    <Badge
                      variant={isDeny ? "danger" : isApproval ? "warning" : "success"}
                      className="text-[10px] uppercase font-mono px-2 py-0.5"
                    >
                      {rule.action}
                    </Badge>
                    <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                      Risk: {rule.riskLevel}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400">{rule.description}</p>
                  <p className="text-[11px] text-zinc-500 font-mono bg-zinc-950/60 p-1.5 rounded inline-block">
                    Reason: {rule.reason}
                  </p>
                </div>

                <div className="flex flex-col items-start md:items-end gap-1 text-[11px] font-mono shrink-0">
                  <div className="text-zinc-400">
                    Tool: <span className="text-purple-300 font-bold">{rule.tool}</span>
                  </div>
                  {rule.pathPattern && (
                    <div className="text-zinc-400">
                      Path: <span className="text-cyan-300">{rule.pathPattern}</span>
                    </div>
                  )}
                  <div className="text-zinc-600 text-[10px]">ID: {rule.id}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Version History */}
      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardHeader className="pb-3 border-b border-zinc-800">
          <CardTitle className="text-sm font-bold text-zinc-200 flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            Policy Version History & Non-Retroactivity Invariant
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 text-xs text-zinc-400 space-y-2">
          <p>
            AgentLedger policies are strictly versioned and immutable once sealed. Updating a policy increments the policy version without modifying historical audit events or retroactively changing previous decisions recorded in the EvidenceKit RFC 8785 hash chain.
          </p>
          <div className="space-y-1.5 pt-2">
            {policyHistory.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800/80 font-mono text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">v{p.version}</span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-300">{p.name}</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-500">
                  <span>{p.rules.length} rules</span>
                  <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                  {idx === policyHistory.length - 1 && (
                    <Badge variant="success" className="text-[10px] px-1.5 py-0.2">
                      ACTIVE
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

