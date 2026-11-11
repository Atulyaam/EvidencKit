import { NextRequest, NextResponse } from "next/server";
import {
  defaultAgentPolicyService,
  evaluateSessionContext,
  validateCsrfProtection,
  requireWorkspaceAuthorization
} from "@evidencekit/evidence-server";

export async function POST(req: NextRequest) {
  try {
    const context = evaluateSessionContext(req.headers);
    validateCsrfProtection(req.headers, context);
    const workspaceId = req.headers.get("x-workspace-id") || "ws_demo_default";
    requireWorkspaceAuthorization(context, workspaceId);

    const body = await req.json();

    if (!body.toolName) {
      return NextResponse.json({ error: "toolName is required for simulation." }, { status: 400 });
    }

    const simulation = defaultAgentPolicyService.simulatePolicy({
      workspaceId,
      sessionId: body.sessionId || "simulation",
      agentName: body.agentName || "simulation-agent",
      toolName: body.toolName,
      operation: body.operation,
      path: body.path,
      args: body.args
    });

    return NextResponse.json({ simulation });
  } catch (err: any) {
    const status =
      err.message?.includes("Forbidden") || err.message?.includes("READ-ONLY")
        ? 403
        : err.message?.includes("CSRF")
          ? 403
          : 500;
    return NextResponse.json({ error: err?.message || "Policy simulation failed" }, { status });
  }
}
