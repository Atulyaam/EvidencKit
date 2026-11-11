import { NextRequest, NextResponse } from "next/server";
import {
  defaultChainService,
  defaultAgentReplayService,
  defaultAgentSessionService,
  evaluateSessionContext,
  requireWorkspaceAuthorization
} from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(_req.headers);
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

    const allEvents = await defaultChainService.getAllEvents(params.id, db);
    const steps = defaultAgentReplayService.buildReplayHistory(allEvents);

    const verification = db
      ? await defaultChainService.verifyStreamFromDb(params.id, db)
      : defaultChainService.verifyInMemory(params.id);

    return NextResponse.json({
      sessionId: params.id,
      totalSteps: steps.length,
      steps,
      verification,
      headHash: allEvents.length > 0 ? allEvents[allEvents.length - 1]!.event_hash : "0".repeat(64)
    });
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("READ-ONLY") ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to build session replay" },
      { status }
    );
  }
}
