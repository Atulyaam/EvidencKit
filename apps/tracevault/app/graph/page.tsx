"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  Share2,
  Filter,
  ShieldCheck,
  AlertCircle,
  Clock,
  Layers,
  ExternalLink,
  Search,
  CheckCircle2,
  Workflow
} from "lucide-react";
import { GraphNode, EvidenceGraphResult } from "@evidencekit/core";

export default function EvidenceGraphPage() {
  const [graphData, setGraphData] = useState<EvidenceGraphResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [relationshipType, setRelationshipType] = useState<"all" | "explicit" | "inferred">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");

  const fetchGraph = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (relationshipType !== "all") params.set("relationshipType", relationshipType);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("limit", "100");

      const res = await fetch(`/api/evidence/graph?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
        if (data.nodes.length > 0 && !selectedNode) {
          setSelectedNode(data.nodes[0]);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [relationshipType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGraph();
  };

  const filteredNodes = (graphData?.nodes || []).filter((node) => {
    if (selectedTypeFilter !== "all" && node.type !== selectedTypeFilter) return false;
    return true;
  });

  const getNodeIcon = (type: string) => {
    switch (type) {
      case "incident":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case "session":
        return <Workflow className="w-4 h-4 text-purple-400" />;
      case "event":
        return <Clock className="w-4 h-4 text-cyan-400" />;
      case "tool_call":
        return <Layers className="w-4 h-4 text-amber-400" />;
      case "approval":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-blue-400" />;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case "incident":
        return "border-red-800/60 bg-red-950/20 text-red-200";
      case "session":
        return "border-purple-800/60 bg-purple-950/20 text-purple-200";
      case "event":
        return "border-cyan-800/60 bg-cyan-950/20 text-cyan-200";
      case "tool_call":
        return "border-amber-800/60 bg-amber-950/20 text-amber-200";
      case "approval":
        return "border-emerald-800/60 bg-emerald-950/20 text-emerald-200";
      default:
        return "border-zinc-800 bg-zinc-900/40 text-zinc-300";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
              <Share2 className="w-6 h-6 text-cyan-400" />
              Unified Evidence Graph
            </h1>
            <Badge variant="outline" className="text-cyan-300 font-mono text-xs">
              Cross-Application
            </Badge>
          </div>
          <p className="text-sm text-zinc-400">
            Interactive relationship graph connecting TraceVault incidents, AgentLedger sessions, tool executions, approval gates, and cryptographic SHA-256 event chains.
          </p>
        </div>

        {/* Global metrics pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">
            Nodes: <span className="text-cyan-400 font-bold">{graphData?.totalNodes || 0}</span>
          </div>
          <div className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">
            Explicit Edges:{" "}
            <span className="text-purple-400 font-bold">{graphData?.explicitCount || 0}</span>
          </div>
          <div className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">
            Candidate Links:{" "}
            <span className="text-amber-400 font-bold">{graphData?.inferredCount || 0}</span>
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>Relationship:</span>
          </div>
          <button
            onClick={() => setRelationshipType("all")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              relationshipType === "all"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            All Relationships
          </button>
          <button
            onClick={() => setRelationshipType("explicit")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              relationshipType === "explicit"
                ? "bg-purple-950 text-purple-300 border border-purple-800"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            Explicit Provenance Only
          </button>
          <button
            onClick={() => setRelationshipType("inferred")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              relationshipType === "inferred"
                ? "bg-amber-950 text-amber-300 border border-amber-800"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            Inferred Candidates (Non-Causal)
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes or IDs..."
              className="pl-8 text-xs bg-zinc-950 border-zinc-700 h-8 w-48 md:w-64"
            />
          </div>
          <Button type="submit" size="sm" className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700">
            Filter
          </Button>
        </form>
      </div>

      {/* Notice Banner */}
      <div className="p-3 rounded-md bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300/90 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong>Causality Disclaimers:</strong> Solid lines represent cryptographic hash-chain connections and explicit container references. Dashed amber lines indicate <em>non-causal candidate relationships</em> inferred from temporal clustering. They do not assert verified root cause.
        </div>
      </div>

      {/* Main Graph Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Node Explorer Canvas / Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              Showing {filteredNodes.length} of {graphData?.totalNodes || 0} nodes (Bounded to 100)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Filter type:</span>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
              >
                <option value="all">All Types</option>
                <option value="incident">Incidents</option>
                <option value="session">Sessions</option>
                <option value="event">Events</option>
                <option value="tool_call">Tool Calls</option>
                <option value="approval">Approvals</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              Loading graph topology...
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-500 border border-zinc-800 rounded-lg">
              No evidence nodes matched the current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[640px] overflow-y-auto pr-1">
              {filteredNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-400 shadow-lg shadow-cyan-950/40"
                        : `${getNodeColor(node.type)} hover:border-zinc-600`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getNodeIcon(node.type)}
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                          {node.type}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase font-mono px-1.5 py-0"
                      >
                        {node.application}
                      </Badge>
                    </div>

                    <h3 className="text-xs font-semibold text-zinc-100 mt-2 line-clamp-1">
                      {node.label}
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">
                      ID: {node.id}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-2 pt-2 border-t border-zinc-800/60">
                      <span>{new Date(node.timestamp).toLocaleTimeString()}</span>
                      {node.hash && (
                        <span className="text-cyan-400">
                          SHA: {node.hash.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Node Inspector Sidebar */}
        <div className="space-y-4">
          <Card className="border-zinc-800 bg-zinc-900/50 sticky top-20">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <CardTitle className="text-sm font-bold text-zinc-200 flex items-center justify-between">
                <span>Node Inspector</span>
                {selectedNode && (
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {selectedNode.type}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              {selectedNode ? (
                <>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Label</span>
                    <p className="text-sm font-semibold text-zinc-100">{selectedNode.label}</p>
                    <p className="text-xs font-mono text-purple-300 break-all">
                      ID: {selectedNode.id}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">
                      Application & Stream
                    </span>
                    <p className="text-zinc-300 capitalize">
                      {selectedNode.application} • Stream: {selectedNode.streamId || "N/A"}
                    </p>
                  </div>

                  {selectedNode.hash && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">
                        Cryptographic Hash (SHA-256)
                      </span>
                      <p className="font-mono text-[11px] text-cyan-400 break-all p-2 rounded bg-zinc-950 border border-zinc-800">
                        {selectedNode.hash}
                      </p>
                    </div>
                  )}

                  {/* Connected Edges */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">
                      Connected Relationships
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {(graphData?.edges || [])
                        .filter(
                          (e) => e.source === selectedNode.id || e.target === selectedNode.id
                        )
                        .map((edge) => (
                          <div
                            key={edge.id}
                            className={`p-2 rounded text-[11px] border ${
                              edge.isNonCausalCandidate
                                ? "bg-amber-950/20 border-amber-800/40 text-amber-300"
                                : "bg-zinc-950 border-zinc-800 text-zinc-300"
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono text-[10px] mb-0.5">
                              <span className="font-bold">{edge.relationship}</span>
                              <span
                                className={
                                  edge.isNonCausalCandidate
                                    ? "text-amber-400"
                                    : "text-purple-400"
                                }
                              >
                                {edge.type}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400">{edge.description}</p>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Navigation Jump */}
                  {selectedNode.type === "incident" && (
                    <Link
                      href={`/incidents/${selectedNode.id}`}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-colors mt-2"
                    >
                      Open Incident in TraceVault <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  {selectedNode.type === "session" && (
                    <a
                      href={`http://localhost:3002/sessions/${selectedNode.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-colors mt-2"
                    >
                      Open Session in AgentLedger ↗
                    </a>
                  )}
                </>
              ) : (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  Click any evidence node to inspect its provenance and relationships.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

