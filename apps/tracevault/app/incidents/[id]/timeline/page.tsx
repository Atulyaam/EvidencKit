"use client";

import { useEffect, useState, use } from "react";
import { ChainedEvent } from "@evidencekit/core";
import {
  Timeline,
  EventDetail,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Button
} from "@evidencekit/ui";

interface TimelinePageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function ForensicTimelinePage({ params }: TimelinePageProps) {
  const resolvedParams = "then" in params ? use(params) : params;
  const incidentId = resolvedParams.id;

  const [events, setEvents] = useState<ChainedEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ChainedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [system, setSystem] = useState("");

  const loadTimeline = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (search) queryParams.set("search", search);
      if (severity) queryParams.set("severity", severity);
      if (system) queryParams.set("system", system);
      queryParams.set("limit", "100");

      const res = await fetch(`/api/incidents/${incidentId}/timeline?${queryParams.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load timeline");
      }

      const data = await res.json();
      const loadedEvents = data.events || [];
      setEvents(loadedEvents);
      if (loadedEvents.length > 0 && !selectedEvent) {
        setSelectedEvent(loadedEvents[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimeline();
  }, [incidentId, severity, system]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTimeline();
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Toolbar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Filter timeline by event name, attribute, or message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Severity:</span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-zinc-200 outline-none focus:border-blue-500"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Source System:</span>
            <select
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-zinc-200 outline-none focus:border-blue-500"
            >
              <option value="">All Systems</option>
              <option value="application">Application</option>
              <option value="git">Git</option>
              <option value="github-actions">GitHub Actions (CI)</option>
              <option value="kubernetes">Kubernetes</option>
              <option value="argo-cd">Argo CD</option>
            </select>
          </div>

          {(search || severity || system) && (
            <button
              onClick={() => {
                setSearch("");
                setSeverity("");
                setSystem("");
              }}
              className="text-xs text-rose-400 hover:text-rose-300 underline ml-auto"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Timeline + Provenance Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Timeline Stream */}
        <div className="lg:col-span-7">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800/80">
              <CardTitle className="text-base text-zinc-100">Forensic Event Stream</CardTitle>
              <span className="text-xs text-zinc-400 font-mono">
                {events.length} event(s) shown
              </span>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="p-8 text-center text-sm text-zinc-500">
                  Loading timeline events...
                </div>
              ) : error ? (
                <div className="p-4 text-center text-xs text-rose-400">{error}</div>
              ) : events.length === 0 ? (
                <div className="p-12 text-center text-sm text-zinc-500">
                  No events found in this incident stream yet. Ingest an evidence source to begin.
                </div>
              ) : (
                <Timeline
                  events={events}
                  selectedEventId={selectedEvent?.event.event_id}
                  onSelectEvent={setSelectedEvent}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Provenance & Event Inspector */}
        <div className="lg:col-span-5 sticky top-20">
          <Card className="border-zinc-800 bg-zinc-900/50 min-h-[450px]">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <CardTitle className="text-base text-zinc-100">Provenance & Hash Inspector</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <EventDetail item={selectedEvent} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
