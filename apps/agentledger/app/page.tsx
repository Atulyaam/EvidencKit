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

const SAMPLE_SESSION_EVENTS: ChainedEvent[] = [
  {
    event: {
      schema_version: "1.0",
      event_id: "0192d8d0-6f3b-7b72-8ad1-1e3e5a1d2001",
      stream_type: "agentledger.session",
      stream_id: "session_01HZXZ9981",
      event_name: "agent.session.created",
      occurred_at: "2026-11-16T14:10:00.000Z",
      observed_at: "2026-11-16T14:10:01.000Z",
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "agent",
        id: "refactoring-assistant"
      },
      severity: "info",
      attributes: {
        goal: "Refactor legacy authentication middleware to use safe session headers"
      }
    },
    stream_sequence: 0,
    previous_hash: "0000000000000000000000000000000000000000000000000000000000000000",
    event_hash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  },
  {
    event: {
      schema_version: "1.0",
      event_id: "0192d8d0-6f3b-7b72-8ad1-1e3e5a1d2002",
      stream_type: "agentledger.session",
      stream_id: "session_01HZXZ9981",
      event_name: "agent.approval.requested",
      occurred_at: "2026-11-16T14:10:15.000Z",
      observed_at: "2026-11-16T14:10:16.000Z",
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "agent",
        id: "refactoring-assistant"
      },
      severity: "warning",
      correlation_ids: ["tool-call-edit-auth"],
      attributes: {
        tool_call_id: "tool-call-edit-auth",
        tool_name: "edit_file",
        arguments: {
          path: "src/auth/session.ts",
          diff: "+ export function verifySession() { ... }"
        }
      }
    },
    stream_sequence: 1,
    previous_hash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    event_hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  },
  {
    event: {
      schema_version: "1.0",
      event_id: "0192d8d0-6f3b-7b72-8ad1-1e3e5a1d2003",
      stream_type: "agentledger.session",
      stream_id: "session_01HZXZ9981",
      event_name: "agent.approval.decided",
      occurred_at: "2026-11-16T14:11:05.000Z",
      observed_at: "2026-11-16T14:11:06.000Z",
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "human_reviewer",
        id: "lead-security-auditor"
      },
      severity: "info",
      correlation_ids: ["tool-call-edit-auth"],
      attributes: {
        tool_call_id: "tool-call-edit-auth",
        decision: "approved",
        reason: "Changes conform to zero-trust session validation guidelines"
      }
    },
    stream_sequence: 2,
    previous_hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    event_hash: "555566667777888899990000aaaabbbbccccddddeeeeffff0000111122223333"
  }
];

export default function AgentLedgerDashboard() {
  const [events] = useState<ChainedEvent[]>(SAMPLE_SESSION_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<ChainedEvent | null>(events[0] || null);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Session #01HZXZ9981: Code Refactoring Audit
          </h2>
          <p className="text-xs text-zinc-400">
            Agent: refactoring-assistant • Instrumented Session Trail
          </p>
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
              <CardTitle className="text-base">Agent Actions & Approvals Timeline</CardTitle>
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
              <CardTitle className="text-base">Tool & Approval Details</CardTitle>
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
