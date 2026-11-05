"use client";

import { useState } from "react";
import { ChainedEvent } from "@evidencekit/core";
import {
  Timeline,
  EventDetail,
  IntegrityStatus,
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from "@evidencekit/ui";

const SAMPLE_CASE_EVENTS: ChainedEvent[] = [
  {
    event: {
      schema_version: "1.0",
      event_id: "0192d8c0-6f3b-7b72-8ad1-1e3e5a1d1001",
      stream_type: "tracevault.case",
      stream_id: "case_01HZX9QK2M",
      event_name: "git.commit.pushed",
      occurred_at: "2026-11-16T10:00:15.000Z",
      observed_at: "2026-11-16T10:00:20.000Z",
      time_confidence: "source_timestamp",
      source: {
        system: "git",
        artifact_id: "artifact_git_01",
        adapter: "git-json",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "user",
        id: "lead-dev@company.com"
      },
      severity: "info",
      correlation_ids: ["commit-a81c2e"],
      attributes: {
        sha: "a81c2e",
        message: "perf(db): optimize user query indexes",
        changed_files_count: 2
      },
      evidence_refs: [
        {
          artifact_id: "artifact_git_01",
          locator_type: "record_number",
          locator: "1"
        }
      ]
    },
    stream_sequence: 0,
    previous_hash: "0000000000000000000000000000000000000000000000000000000000000000",
    event_hash: "4f8a29a07156bd4e4f71a0d8e20297dc68f94e9f73229b47bb9a79faef58897c"
  },
  {
    event: {
      schema_version: "1.0",
      event_id: "0192d8c0-6f3b-7b72-8ad1-1e3e5a1d1002",
      stream_type: "tracevault.case",
      stream_id: "case_01HZX9QK2M",
      event_name: "ci.job.failure",
      occurred_at: "2026-11-16T10:02:14.000Z",
      observed_at: "2026-11-16T10:02:20.000Z",
      time_confidence: "source_timestamp",
      source: {
        system: "github-actions",
        artifact_id: "artifact_ci_01",
        adapter: "ci-json",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "service",
        id: "gh-runner-04"
      },
      severity: "error",
      correlation_ids: ["commit-a81c2e", "job-48291"],
      attributes: {
        workflow: "Integration Test Suite",
        job_id: "job-48291",
        status: "failure",
        error: "Migration failed: relation 'user_idx_composite' already exists"
      },
      evidence_refs: [
        {
          artifact_id: "artifact_ci_01",
          locator_type: "record_number",
          locator: "1"
        }
      ]
    },
    stream_sequence: 1,
    previous_hash: "4f8a29a07156bd4e4f71a0d8e20297dc68f94e9f73229b47bb9a79faef58897c",
    event_hash: "9b3c43ea5688d0112423ef89073ef9b68a7356247c4e259e8f66ea6d12345678"
  }
];

export default function TraceVaultDashboard() {
  const [events] = useState<ChainedEvent[]>(SAMPLE_CASE_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<ChainedEvent | null>(events[0] || null);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Case #01HZX9QK2M: Production DB Migration Failure
          </h2>
          <p className="text-xs text-zinc-400">Environment: production • Reconstructed Timeline</p>
        </div>
        <div className="flex items-center gap-3">
          <IntegrityStatus
            status="verified"
            totalEvents={events.length}
            headHash={events[events.length - 1]?.event_hash}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Timeline column */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Evidence Timeline</CardTitle>
              <span className="text-xs text-zinc-400 font-mono">Sorted by occurred_at</span>
            </CardHeader>
            <CardContent>
              <Timeline
                events={events}
                selectedEventId={selectedEvent?.event.event_id}
                onSelectEvent={setSelectedEvent}
              />
            </CardContent>
          </Card>
        </div>

        {/* Detail column */}
        <div className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Evidence & Provenance Inspector</CardTitle>
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
