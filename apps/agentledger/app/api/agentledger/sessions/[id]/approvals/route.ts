import { NextRequest, NextResponse } from "next/server";
import {
  defaultAgentApprovalService,
  evaluateSessionContext,
  validateCsrfProtection,
  requireWorkspaceAuthorization
} from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(req.headers);
    const authorized = context.authorizedWorkspaces || [];
    const workspaceId: string =
      req.nextUrl.searchParams.get("workspaceId") ||
      (authorized.length > 0 && authorized[0] !== "*" ? authorized[0]! : "ws_demo_default");

    requireWorkspaceAuthorization(context, workspaceId);

    let db;
    try {
      db = getDb();
    } catch {
      // In-memory fallback
    }

    const approvals = await defaultAgentApprovalService.listApprovals(params.id, db);
    return NextResponse.json({ approvals, total: approvals.length });
  } catch (error: any) {
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Failed to list approvals" }, { status });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(req.headers);
    validateCsrfProtection(req.headers, context);
    const authorized = context.authorizedWorkspaces || [];
    const workspaceId: string =
      req.nextUrl.searchParams.get("workspaceId") ||
      (authorized.length > 0 && authorized[0] !== "*" ? authorized[0]! : "ws_demo_default");

    requireWorkspaceAuthorization(context, workspaceId);

    const body = await req.json();

    let db;
    try {
      db = getDb();
    } catch {
      // In-memory fallback
    }

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
