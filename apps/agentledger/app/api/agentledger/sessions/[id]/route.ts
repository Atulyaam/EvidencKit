import { NextRequest, NextResponse } from "next/server";
import {
  defaultAgentSessionService,
  defaultChainService,
  evaluateSessionContext
} from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const workspaceId =
      req.nextUrl.searchParams.get("workspaceId") ||
      req.headers.get("x-workspace-id") ||
      "ws_demo_default";
    const db = getDb();

    const session = await defaultAgentSessionService.getSession(params.id, workspaceId, db);
    if (!session) {
      return NextResponse.json({ error: `Session '${params.id}' not found` }, { status: 404 });
    }

    // Get event chain summary
    const events = await defaultChainService.getAllEvents(params.id, db);
    const verification = db
      ? await defaultChainService.verifyStreamFromDb(params.id, db)
      : defaultChainService.verifyInMemory(params.id);

    const headHash = events.length > 0 ? events[events.length - 1]!.event_hash : "0".repeat(64);

    return NextResponse.json({
      session,
      eventCount: events.length,
      headHash,
      verification
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to retrieve session" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(req.headers);
    const workspaceId =
      req.nextUrl.searchParams.get("workspaceId") ||
      req.headers.get("x-workspace-id") ||
      "ws_demo_default";
    const body = await req.json();
    const action = body.action as string; // 'start' | 'pause' | 'complete' | 'fail' | 'cancel'
    const db = getDb();

    let updated;
    switch (action) {
      case "start":
        updated = await defaultAgentSessionService.startSession(
          params.id,
          context,
          workspaceId,
          db
        );
        break;
      case "pause":
        updated = await defaultAgentSessionService.pauseSession(
          params.id,
          context,
          workspaceId,
          db
        );
        break;
      case "complete":
        updated = await defaultAgentSessionService.completeSession(
          params.id,
          body.summary || "Session completed by operator",
          context,
          workspaceId,
          db
        );
        break;
      case "fail":
        updated = await defaultAgentSessionService.failSession(
          params.id,
          body.error || "Session failed",
          context,
          workspaceId,
          db
        );
        break;
      case "cancel":
        updated = await defaultAgentSessionService.cancelSession(
          params.id,
          body.reason || "Session cancelled by operator",
          context,
          workspaceId,
          db
        );
        break;
      default:
        return NextResponse.json({ error: `Unsupported action '${action}'` }, { status: 400 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("Unauthorized") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Failed to update session" }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(req.headers);
    const workspaceId =
      req.nextUrl.searchParams.get("workspaceId") ||
      req.headers.get("x-workspace-id") ||
      "ws_demo_default";
    const db = getDb();

    const deleted = await defaultAgentSessionService.deleteSession(
      params.id,
      context,
      workspaceId,
      db
    );
    if (!deleted) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("Unauthorized") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Failed to delete session" }, { status });
  }
}
