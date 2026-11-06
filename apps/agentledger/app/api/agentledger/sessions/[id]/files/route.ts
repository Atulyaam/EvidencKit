import { NextRequest, NextResponse } from "next/server";
import { defaultChainService } from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const allEvents = await defaultChainService.getAllEvents(params.id, db);

    // Filter events where event_name === 'agent.file.changed'
    const fileEvents = allEvents.filter((e) => e.event.event_name === "agent.file.changed");

    const files = fileEvents.map((e) => {
      const attrs = (e.event.attributes || {}) as Record<string, unknown>;
      return {
        eventId: e.event.event_id,
        sequence: e.stream_sequence,
        timestamp: e.event.occurred_at,
        toolCallId: attrs.tool_call_id || e.event.correlation_ids?.[0],
        path: attrs.path,
        operation: attrs.operation || "modify",
        oldSha256: attrs.old_sha256,
        newSha256: attrs.new_sha256,
        linesAdded: attrs.lines_added,
        linesRemoved: attrs.lines_removed,
        diffSummary: attrs.diff_summary
      };
    });

    return NextResponse.json({ files, total: files.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to retrieve file changes" },
      { status: 500 }
    );
  }
}
