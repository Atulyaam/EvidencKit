import { NextRequest, NextResponse } from "next/server";
import { defaultAgentPolicyService } from "@evidencekit/evidence-server";

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.headers.get("x-workspace-id") || "default";
    const active = defaultAgentPolicyService.getActivePolicy(workspaceId);
    const history = defaultAgentPolicyService.getPolicyHistory(workspaceId);

    return NextResponse.json({
      active,
      history,
      totalVersions: history.length
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to retrieve policies" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const workspaceId = req.headers.get("x-workspace-id") || "default";
    const body = await req.json();

    if (!body.name || !body.version || !Array.isArray(body.rules)) {
      return NextResponse.json(
        { error: "Invalid policy payload: name, version, and rules array are required." },
        { status: 400 }
      );
    }

    const saved = defaultAgentPolicyService.savePolicyVersion(workspaceId, {
      version: body.version,
      workspaceId,
      name: body.name,
      description: body.description || "",
      defaultDecision: body.defaultDecision || "REQUIRE_APPROVAL",
      rules: body.rules
    });

    return NextResponse.json({ policy: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save policy version" },
      { status: 500 }
    );
  }
}
