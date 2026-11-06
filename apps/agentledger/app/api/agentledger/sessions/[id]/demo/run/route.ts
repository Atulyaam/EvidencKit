import { NextRequest, NextResponse } from "next/server";
import {
  defaultAgentDemoService,
  defaultAgentSessionService,
  evaluateSessionContext
} from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(req.headers);
    const workspaceId =
      req.nextUrl.searchParams.get("workspaceId") ||
      req.headers.get("x-workspace-id") ||
      "ws_demo_default";
    const db = getDb();

    let session = await defaultAgentSessionService.getSession(params.id, workspaceId, db);
    const body = await req.json().catch(() => ({}));

    // If session doesn't exist, create it with specified goal/name or use default demo
    const demoResult = await defaultAgentDemoService.runFullDemo(
      {
        workspaceId,
        agentName: session?.agentName || body.agentName || "refactoring-assistant",
        goal: session?.goal || body.goal
      },
      context,
      db
    );

    return NextResponse.json(demoResult);
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("Unauthorized") ? 403 : 400;
    return NextResponse.json(
      { error: error.message || "Failed to execute demo workflow" },
      { status }
    );
  }
}
