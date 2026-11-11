"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Input,
  Breadcrumbs,
  BreadcrumbItem,
  LoadingState,
  EmptyState
} from "@evidencekit/ui";
import {
  Share2,
  Filter,
  ShieldCheck,
  AlertCircle,
  Clock,
  Layers,
  Search,
  CheckCircle2,
  Workflow,
  AlertTriangle
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <Breadcrumbs>
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Evidence Graph</BreadcrumbItem>
      </Breadcrumbs>

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
            Interactive relationship graph connecting TraceVault incidents, AgentLedger sessions,
            tool executions, approval gates, and cryptographic SHA-256 event chains.
          </p>
        </div>

        {/* Global metrics pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-sm">
            Nodes: <span className="text-cyan-400 font-bold">{graphData?.totalNodes || 0}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-sm">
            Explicit Edges:{" "}
            <span className="text-purple-400 font-bold">{graphData?.explicitCount || 0}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-sm">
            Candidate Links:{" "}
            <span className="text-amber-400 font-bold">{graphData?.inferredCount || 0}</span>
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mr-2 font-medium">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <span>Relationship:</span>
          </div>
          <button
            type="button"
            onClick={() => setRelationshipType("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              relationshipType === "all"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-sm"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            All Relationships
          </button>
          <button
            type="button"
            onClick={() => setRelationshipType("explicit")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              relationshipType === "explicit"
                ? "bg-purple-950 text-purple-300 border border-purple-800 shadow-sm"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            Explicit Provenance Only
          </button>
          <button
            type="button"
            onClick={() => setRelationshipType("inferred")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              relationshipType === "inferred"
                ? "bg-amber-950 text-amber-300 border border-amber-800 shadow-sm"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            Inferred Candidates (Non-Causal)
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes or IDs..."
            leftIcon={<Search className="w-3.5 h-3.5 text-zinc-500" />}
            className="text-xs bg-zinc-950 border-zinc-700 h-9 w-full md:w-64"
          />
          <Button type="submit" size="sm" variant="outline" className="h-9 text-xs">
            Filter
          </Button>
        </form>
      </div>

      {/* Notice Banner */}
      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300/90 flex items-start gap-3 shadow-sm">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-amber-200 font-semibold block mb-0.5">
            Causality Disclaimers:
          </strong>{" "}
          Solid lines represent cryptographic hash-chain connections and explicit container
          references. Dashed amber lines indicate{" "}
          <em className="text-amber-200">non-causal candidate relationships</em> inferred from
          temporal clustering. They do not assert verified root cause.
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
                className="bg-zinc-900 border border-zinc-700 rounded-md px-2.5 py-1 text-xs text-zinc-200 outline-none focus:border-cyan-500"
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
            <LoadingState
              message="Loading graph topology..."
              description="Constructing cross-application relationship graph..."
            />
          ) : filteredNodes.length === 0 ? (
            <EmptyState
              title="No Evidence Nodes Found"
              description="No evidence nodes matched the current filter. Try selecting 'All Relationships' or clearing the search."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[640px] overflow-y-auto pr-1">
              {filteredNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
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
                      <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[120px]">
                        {node.id}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-zinc-100 mt-2 truncate">
                      {node.label}
                    </h4>

                    {node.application && (
                      <span className="inline-block mt-2 text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900/80 text-zinc-400 border border-zinc-800">
                        {node.application}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Node Inspector */}
        <div className="lg:col-span-1">
          <Card className="border-zinc-800 bg-zinc-900/60 sticky top-20 shadow-md">
            <CardHeader className="border-b border-zinc-800 pb-3">
              <CardTitle className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Node Inspector
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              {selectedNode ? (
                <>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 block">
                      Label
                    </span>
                    <h3 className="font-semibold text-zinc-100 text-sm">{selectedNode.label}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-zinc-500 block">
                        Type
                      </span>
                      <span className="font-mono text-cyan-400 capitalize">
                        {selectedNode.type}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-zinc-500 block">
                        Application
                      </span>
                      <span className="font-mono text-zinc-300">
                        {selectedNode.application || "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 block">
                      Node ID
                    </span>
                    <p className="font-mono text-[11px] text-zinc-400 break-all bg-zinc-950 p-2 rounded border border-zinc-800 select-all">
                      {selectedNode.id}
                    </p>
                  </div>

                  {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-zinc-500 block">
                        Metadata
                      </span>
                      <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-48 leading-relaxed">
                        {JSON.stringify(selectedNode.metadata, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Connected Edges */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 block font-semibold">
                      Connected Relationships
                    </span>
                    {(() => {
                      const edges = (graphData?.edges || []).filter(
                        (e) => e.source === selectedNode.id || e.target === selectedNode.id
                      );
                      if (edges.length === 0) {
                        return (
                          <p className="text-zinc-500 text-[11px] italic">
                            No direct edges connected.
                          </p>
                        );
                      }
                      return (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {edges.map((edge, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded bg-zinc-950 border border-zinc-800 text-[11px] space-y-0.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-cyan-400 text-[10px]">
                                  {edge.relationship}
                                </span>
                                <span
                                  className={`text-[9px] uppercase font-mono px-1 rounded ${
                                    edge.type === "explicit"
                                      ? "bg-purple-950 text-purple-300"
                                      : "bg-amber-950 text-amber-300"
                                  }`}
                                >
                                  {edge.type}
                                </span>
                              </div>
                              <div className="text-zinc-400 truncate">
                                {edge.source === selectedNode.id ? "→ Target: " : "← Source: "}
                                <span className="font-mono text-zinc-300">
                                  {edge.source === selectedNode.id ? edge.target : edge.source}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <p className="text-zinc-500 italic">Select a node to inspect relationships.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
