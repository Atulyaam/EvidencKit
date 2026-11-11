import { NextRequest, NextResponse } from "next/server";
import {
  defaultAgentPolicyService,
  evaluateSessionContext,
  validateCsrfProtection,
  requireOwnerAuthorization,
  requireWorkspaceAuthorization
} from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(req: NextRequest) {
  try {
    const context = evaluateSessionContext(req.headers);
    const { searchParams } = new URL(req.url);
    const requestedWorkspace = searchParams.get("workspaceId");
    const authorized = context.authorizedWorkspaces || [];
    const workspaceId: string =
      requestedWorkspace ||
      (authorized.length > 0 && authorized[0] !== "*" ? authorized[0]! : "ws_demo_default");

    requireWorkspaceAuthorization(context, workspaceId);

    let db;
    try {
      db = getDb();
      await defaultAgentPolicyService.loadPoliciesFromDb(workspaceId, db);
    } catch {
      // In-memory fallback
    }

    const active = defaultAgentPolicyService.getActivePolicy(workspaceId);
    const history = defaultAgentPolicyService.getPolicyHistory(workspaceId);

    return NextResponse.json({
      active,
      history,
      totalVersions: history.length
    });
  } catch (err: any) {
    const status =
      err?.message?.includes("Forbidden") || err?.message?.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: err?.message || "Failed to retrieve policies" }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = evaluateSessionContext(req.headers);
    validateCsrfProtection(req.headers, context);
    requireOwnerAuthorization(context);

    const { searchParams } = new URL(req.url);
    const requestedWorkspace = searchParams.get("workspaceId");
    const body = await req.json();
    const workspaceId: string = requestedWorkspace || body.workspaceId || "ws_demo_default";

    requireWorkspaceAuthorization(context, workspaceId);

    if (!body.name || !body.version || !Array.isArray(body.rules)) {
      return NextResponse.json(
        { error: "Invalid policy payload: name, version, and rules array are required." },
        { status: 400 }
      );
    }

    let db;
    try {
      db = getDb();
    } catch {
      // In-memory fallback
    }

    const saved = defaultAgentPolicyService.savePolicyVersion(
      workspaceId,
      {
        version: body.version,
        workspaceId,
        name: body.name,
        description: body.description || "",
        defaultDecision: body.defaultDecision || "REQUIRE_APPROVAL",
        rules: body.rules
      },
      db
    );

    return NextResponse.json({ policy: saved }, { status: 201 });
  } catch (err: any) {
    const status =
      err?.message?.includes("Forbidden") || err?.message?.includes("Unauthorized") ? 403 : 400;
    return NextResponse.json(
      { error: err?.message || "Failed to save policy version" },
      { status }
    );
  }
}
