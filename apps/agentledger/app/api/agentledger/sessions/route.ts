import { NextRequest, NextResponse } from "next/server";
import { defaultAgentSessionService, evaluateSessionContext } from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const workspaceId =
      url.searchParams.get("workspaceId") || req.headers.get("x-workspace-id") || "ws_demo_default";
    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const agentName = url.searchParams.get("agentName") || undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 20;
    const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;

    const db = getDb();
    const result = await defaultAgentSessionService.listSessions(
      { status, search, agentName, limit, offset, workspaceId },
      workspaceId,
      db
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to list sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = evaluateSessionContext(req.headers);
    const body = await req.json();
    const db = getDb();

    const session = await defaultAgentSessionService.createSession(body, context, db);
    return NextResponse.json(session, { status: 201 });
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("Unauthorized") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Failed to create session" }, { status });
  }
}
