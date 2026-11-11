import { NextRequest, NextResponse } from "next/server";
import {
  defaultAgentSessionService,
  evaluateSessionContext,
  validateCsrfProtection
} from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(req: NextRequest) {
  try {
    const context = evaluateSessionContext(req.headers);
    const url = new URL(req.url);
    const authorized = context.authorizedWorkspaces || [];
    const workspaceId: string =
      url.searchParams.get("workspaceId") ||
      (authorized.length > 0 && authorized[0] !== "*" ? authorized[0]! : "ws_demo_default");
    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const agentName = url.searchParams.get("agentName") || undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 20;
    const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;

    let db;
    try {
      db = getDb();
    } catch {
      // In-memory fallback
    }

    const result = await defaultAgentSessionService.listSessions(
      { status, search, agentName, limit, offset, workspaceId },
      workspaceId,
      db,
      context
    );

    return NextResponse.json(result);
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Failed to list sessions" }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = evaluateSessionContext(req.headers);
    validateCsrfProtection(req.headers, context);
    const body = await req.json();

    let db;
    try {
      db = getDb();
    } catch {
      // In-memory fallback
    }

    const session = await defaultAgentSessionService.createSession(body, context, db);
    return NextResponse.json(session, { status: 201 });
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("Unauthorized") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Failed to create session" }, { status });
  }
}
