"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChainedEvent } from "@evidencekit/core";
import {
  Timeline,
  EventDetail,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Button,
  LoadingState,
  EmptyState,
  ErrorState
} from "@evidencekit/ui";
import { Clock, Search, Filter, RotateCcw, ShieldCheck } from "lucide-react";

interface TimelinePageProps {
  params?: { id: string };
}

export default function ForensicTimelinePage({ params }: TimelinePageProps) {
  const routeParams = useParams();
  const incidentId = (routeParams?.id as string) || params?.id || "";

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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Filter timeline by event name, attribute, or message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-zinc-500" />}
            />
          </div>
          <Button type="submit" variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-zinc-800/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-medium">Severity:</span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="bg-zinc-900 border border-zinc-700/80 rounded-md px-2.5 py-1 text-zinc-200 text-xs outline-none focus:border-blue-500 transition-colors"
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
            <span className="text-zinc-400 font-medium">Source System:</span>
            <select
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              className="bg-zinc-900 border border-zinc-700/80 rounded-md px-2.5 py-1 text-zinc-200 text-xs outline-none focus:border-blue-500 transition-colors"
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
              type="button"
              onClick={() => {
                setSearch("");
                setSeverity("");
                setSystem("");
              }}
              className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 underline ml-auto transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Timeline + Provenance Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Timeline Stream */}
        <div className="lg:col-span-7">
          <Card className="border-zinc-800 bg-zinc-900/50 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800/80">
              <div>
                <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Forensic Event Stream
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-0.5">
                  Ordered chronological ledger of tamper-evident chained records.
                </CardDescription>
              </div>
              <span className="text-xs text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                {events.length} event(s) shown
              </span>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <LoadingState
                  message="Loading timeline events..."
                  description="Verifying chronological hash-chain sequence..."
                />
              ) : error ? (
                <ErrorState title="Timeline Query Error" error={error} onRetry={loadTimeline} />
              ) : events.length === 0 ? (
                <EmptyState
                  title="No Events Found"
                  description="No events found in this incident stream yet. Ingest an evidence source to begin reconstruction."
                />
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
          <Card className="border-zinc-800 bg-zinc-900/50 min-h-[450px] shadow-md">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Provenance & Hash Inspector
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">
                Inspect raw RFC 8785 canonical hash and exact source locator.
              </CardDescription>
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
