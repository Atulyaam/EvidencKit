import { NextRequest, NextResponse } from "next/server";
import {
  defaultAgentSandboxService,
  defaultAgentSessionService,
  evaluateSessionContext,
  requireOwnerAuthorization
} from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(req.headers);
    requireOwnerAuthorization(context);
    const workspaceId =
      req.nextUrl.searchParams.get("workspaceId") ||
      req.headers.get("x-workspace-id") ||
      "ws_demo_default";
    const body = await req.json();
    const db = getDb();

    const session = await defaultAgentSessionService.getSession(params.id, workspaceId, db);
    if (!session) {
      return NextResponse.json({ error: `Session '${params.id}' not found` }, { status: 404 });
    }

    const result = await defaultAgentSandboxService.executeTool({
      sessionId: params.id,
      agentName: session.agentName,
      toolCallId: body.toolCallId,
      toolName: body.toolName,
      args: body.args || {},
      approvalId: body.approvalId,
      db
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("Unauthorized") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Failed to execute tool" }, { status });
  }
}
