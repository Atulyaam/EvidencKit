import { NextRequest, NextResponse } from "next/server";
import { defaultAgentApprovalService, evaluateSessionContext } from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const approvals = await defaultAgentApprovalService.listApprovals(params.id, db);
    return NextResponse.json({ approvals, total: approvals.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to list approvals" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(req.headers);
    const workspaceId =
      req.nextUrl.searchParams.get("workspaceId") ||
      req.headers.get("x-workspace-id") ||
      "ws_demo_default";
    const body = await req.json();
    const db = getDb();

    // Check if it's a decision or a request
    if (body.approvalId && body.decision) {
      const decided = await defaultAgentApprovalService.decideApproval(
        {
          approvalId: body.approvalId,
          decision: body.decision,
          reason: body.reason
        },
        context,
        workspaceId,
        db
      );
      return NextResponse.json(decided);
    } else {
      const created = await defaultAgentApprovalService.requestApproval(
        {
          sessionId: params.id,
          toolCallId: body.toolCallId,
          toolName: body.toolName,
          operation: body.operation,
          arguments: body.arguments,
          reason: body.reason
        },
        context,
        workspaceId,
        db
      );
      return NextResponse.json(created, { status: 201 });
    }
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("Unauthorized") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Failed to process approval" }, { status });
  }
}
