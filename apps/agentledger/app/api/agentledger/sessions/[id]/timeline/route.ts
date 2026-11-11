import { NextRequest, NextResponse } from "next/server";
import {
  defaultChainService,
  defaultAgentSessionService,
  evaluateSessionContext,
  requireWorkspaceAuthorization
} from "@evidencekit/evidence-server";
import { queryTimeline, EventSeverity } from "@evidencekit/core";
import { getDb } from "@evidencekit/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(req.headers);
    const db = getDb();
    const session = await defaultAgentSessionService.getSession(
      params.id,
      "ws_demo_default",
      db,
      context
    );
    if (!session) {
      return NextResponse.json({ error: `Session '${params.id}' not found` }, { status: 404 });
    }
    requireWorkspaceAuthorization(context, session.workspaceId);

    const url = req.nextUrl;
    const severity = url.searchParams.get("severity") as EventSeverity | null;
    const eventName = url.searchParams.get("eventName") || undefined;
    const system = url.searchParams.get("system") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 50;
    const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;

    const allEvents = await defaultChainService.getAllEvents(params.id, db);

    const result = queryTimeline(allEvents, {
      severity: severity || undefined,
      eventName,
      system,
      search,
      limit,
      offset
    });

    const verification = db
      ? await defaultChainService.verifyStreamFromDb(params.id, db)
      : defaultChainService.verifyInMemory(params.id);

    return NextResponse.json({
      ...result,
      verification,
      headHash: allEvents.length > 0 ? allEvents[allEvents.length - 1]!.event_hash : "0".repeat(64)
    });
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("READ-ONLY") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Failed to retrieve timeline" }, { status });
  }
}
