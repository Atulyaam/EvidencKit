import { NextRequest, NextResponse } from "next/server";
import {
  defaultAgentSandboxService,
  defaultAgentSessionService,
  evaluateSessionContext,
  validateCsrfProtection,
  requireOwnerAuthorization,
  requireWorkspaceAuthorization
} from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(req.headers);
    validateCsrfProtection(req.headers, context);
    requireOwnerAuthorization(context);

    const authorized = context.authorizedWorkspaces || [];
    const workspaceId: string =
      req.nextUrl.searchParams.get("workspaceId") ||
      (authorized.length > 0 && authorized[0] !== "*" ? authorized[0]! : "ws_demo_default");

    let db;
    try {
      db = getDb();
    } catch {
      // In-memory fallback
    }

    const session = await defaultAgentSessionService.getSession(
      params.id,
      workspaceId,
      db,
      context
    );
    if (!session) {
      return NextResponse.json({ error: `Session '${params.id}' not found` }, { status: 404 });
    }

    requireWorkspaceAuthorization(context, session.workspaceId);

    const body = await req.json();

    const result = await defaultAgentSandboxService.executeTool({
      sessionId: params.id,
      agentName: session.agentName,
      toolCallId: body.toolCallId,
      toolName: body.toolName,
      args: body.args || {},
      approvalId: body.approvalId,
      workspaceId: session.workspaceId,
      db
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("Unauthorized") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Failed to execute tool" }, { status });
  }
}
