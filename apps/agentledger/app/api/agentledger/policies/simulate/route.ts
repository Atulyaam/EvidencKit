import { NextRequest, NextResponse } from "next/server";
import { defaultAgentPolicyService } from "@evidencekit/evidence-server";

export async function POST(req: NextRequest) {
  try {
    const workspaceId = req.headers.get("x-workspace-id") || "default";
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
    return NextResponse.json(
      { error: err?.message || "Policy simulation failed" },
      { status: 500 }
    );
  }
}
