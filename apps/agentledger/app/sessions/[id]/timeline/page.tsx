"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input } from "@evidencekit/ui";
import { ChainedEvent } from "@evidencekit/core";
import {
  Search,
  ShieldCheck,
  Bot,
  UserCheck,
  FileCode,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Terminal,
  Clock
} from "lucide-react";

export default function SessionTimelinePage({ params }: { params: { id: string } }) {
  const [events, setEvents] = useState<ChainedEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ChainedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const loadTimeline = async () => {
    try {
      const res = await fetch(`/api/agentledger/sessions/${params.id}/timeline?limit=200`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        if (data.events && data.events.length > 0 && !selectedEvent) {
          setSelectedEvent(data.events[0]);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimeline();
  }, [params.id]);

  const filteredEvents = events.filter((e) => {
    if (filterType !== "all" && e.event.event_name !== filterType) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = e.event.event_name.toLowerCase();
      const attrStr = JSON.stringify(e.event.attributes || {}).toLowerCase();
      return name.includes(q) || attrStr.includes(q);
    }
    return true;
  });

  const getEventIcon = (name: string) => {
    switch (name) {
      case "agent.session.created":
      case "agent.run.started":
        return <Bot className="w-4 h-4 text-purple-400" />;
      case "agent.tool.started":
        return <Terminal className="w-4 h-4 text-blue-400" />;
      case "agent.tool.completed":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "agent.tool.failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "agent.approval.requested":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case "agent.approval.decided":
        return <UserCheck className="w-4 h-4 text-cyan-400" />;
      case "agent.file.changed":
        return <FileCode className="w-4 h-4 text-emerald-400" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter and Search Bar */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search events by type, tool name, or attributes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-zinc-950 border-zinc-700 text-xs w-full"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 text-zinc-300 text-xs rounded-md h-9 px-3 outline-none focus:border-purple-500"
            >
              <option value="all">All Event Types ({events.length})</option>
              <option value="agent.session.created">Session Created</option>
              <option value="agent.run.started">Run Started</option>
              <option value="agent.tool.started">Tool Started</option>
              <option value="agent.tool.completed">Tool Completed</option>
              <option value="agent.tool.failed">Tool Failed</option>
              <option value="agent.approval.requested">Approval Requested</option>
              <option value="agent.approval.decided">Approval Decided</option>
              <option value="agent.file.changed">File Changed</option>
              <option value="agent.run.completed">Run Completed</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={loadTimeline}
              className="h-9 text-xs border-zinc-700 hover:bg-zinc-800 whitespace-nowrap"
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Timeline & Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Event List Column */}
        <div className="lg:col-span-7 space-y-3">
          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-sm">Loading timeline events...</div>
          ) : filteredEvents.length === 0 ? (
            <Card className="bg-zinc-900/40 border-zinc-800">
              <CardContent className="p-12 text-center text-zinc-400 text-sm">
                No events matched your search filter.
              </CardContent>
            </Card>
          ) : (
            filteredEvents.map((chained) => {
              const ev = chained.event;
              const isSelected = selectedEvent?.event.event_id === ev.event_id;
              const attrs = (ev.attributes || {}) as Record<string, unknown>;

              return (
                <div
                  key={ev.event_id}
                  onClick={() => setSelectedEvent(chained)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-purple-950/30 border-purple-500/80 shadow-md shadow-purple-950/40"
                      : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                        {getEventIcon(ev.event_name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-zinc-200">
                            {ev.event_name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            Seq #{chained.stream_sequence}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                          {ev.occurred_at ? new Date(ev.occurred_at).toLocaleTimeString() : "N/A"} •
                          Actor: {ev.actor?.id || "agent"}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={
                        ev.severity === "critical"
                          ? "danger"
                          : ev.severity === "warning"
                            ? "warning"
                            : "outline"
                      }
                      className="text-[9px] uppercase font-mono px-1.5 py-0"
                    >
                      {ev.severity}
                    </Badge>
                  </div>

                  {/* Attribute summary line */}
                  <div className="mt-2.5 pt-2 border-t border-zinc-800/60 text-xs text-zinc-300 font-mono truncate">
                    {Boolean(attrs.tool_name) && (
                      <span>
                        Tool:{" "}
                        <strong className="text-purple-300">{String(attrs.tool_name)}</strong>{" "}
                      </span>
                    )}
                    {Boolean(attrs.path) && (
                      <span>
                        Path:{" "}
                        <strong className="text-emerald-300">{String(attrs.path)}</strong>{" "}
                      </span>
                    )}
                    {Boolean(attrs.decision) && (
                      <span>
                        Decision:{" "}
                        <strong className="text-cyan-300">{String(attrs.decision)}</strong>{" "}
                      </span>
                    )}
                    {Boolean(attrs.goal) && (
                      <span className="text-zinc-300">
                        Goal: {String(attrs.goal).slice(0, 80)}...
                      </span>
                    )}
                    {Boolean(attrs.summary) && (
                      <span className="text-zinc-300">
                        Summary: {String(attrs.summary).slice(0, 80)}...
                      </span>
                    )}
                    {Boolean(attrs.error) && (
                      <span className="text-red-400">Error: {String(attrs.error)}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Provenance & Hash Inspector Column */}
        <div className="lg:col-span-5">
          <div className="sticky top-20">
            {selectedEvent ? (
              <Card className="bg-zinc-900/60 border-zinc-800 shadow-xl">
                <CardHeader className="pb-3 border-b border-zinc-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-400" /> Provenance & Hash
                      Inspector
                    </CardTitle>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      RFC8785 Sealed
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4 text-xs">
                  {/* Event Metadata */}
                  <div className="space-y-2 font-mono">
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Event ID:</span>
                      <span className="text-zinc-300">{selectedEvent.event.event_id}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Event Type:</span>
                      <span className="text-purple-300 font-semibold">
                        {selectedEvent.event.event_name}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Sequence Index:</span>
                      <span className="text-zinc-300">#{selectedEvent.stream_sequence}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Source System:</span>
                      <span className="text-zinc-300">
                        {selectedEvent.event.source?.system} ({selectedEvent.event.source?.adapter})
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Actor Type:</span>
                      <span className="text-zinc-300">
                        {selectedEvent.event.actor?.type}: {selectedEvent.event.actor?.id}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Timestamp:</span>
                      <span className="text-zinc-300">
                        {selectedEvent.event.occurred_at
                          ? new Date(selectedEvent.event.occurred_at).toISOString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Cryptographic Hashes */}
                  <div className="space-y-2">
                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] space-y-1">
                      <span className="text-zinc-500 block text-[10px] uppercase">
                        Event Hash (SHA-256)
                      </span>
                      <span className="text-purple-400 break-all">{selectedEvent.event_hash}</span>
                    </div>

                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] space-y-1">
                      <span className="text-zinc-500 block text-[10px] uppercase">
                        Previous Link Hash
                      </span>
                      <span className="text-zinc-400 break-all">{selectedEvent.previous_hash}</span>
                    </div>
                  </div>

                  {/* Attributes JSON */}
                  <div className="space-y-1.5">
                    <span className="text-zinc-400 font-mono text-[11px] uppercase">
                      Event Payload Attributes:
                    </span>
                    <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-64 whitespace-pre-wrap">
                      {JSON.stringify(selectedEvent.event.attributes, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-zinc-900/40 border-zinc-800 text-center p-8 text-zinc-500 text-xs">
                Select an event from the timeline to inspect its cryptographic provenance and
                payload.
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
