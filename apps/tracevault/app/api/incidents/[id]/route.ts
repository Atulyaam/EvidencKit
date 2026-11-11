import { NextRequest, NextResponse } from "next/server";
import {
  defaultIncidentService,
  evaluateSessionContext,
  validateCsrfProtection
} from "@evidencekit/evidence-server";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(request.headers);
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") || "ws_demo_default";

    const incident = await defaultIncidentService.getIncident(
      params.id,
      workspaceId,
      undefined,
      context
    );
    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }
    return NextResponse.json(incident);
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") || err.message.includes("Unauthorized") ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(request.headers);
    validateCsrfProtection(request.headers, context);
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") || "ws_demo_default";
    const body = await request.json();

    const updated = await defaultIncidentService.updateIncident(
      params.id,
      body,
      context,
      workspaceId
    );
    return NextResponse.json(updated);
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") ||
      err.message.includes("Unauthorized") ||
      err.message.includes("READ-ONLY")
        ? 403
        : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(request.headers);
    validateCsrfProtection(request.headers, context);
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") || "ws_demo_default";

    const deleted = await defaultIncidentService.deleteIncident(params.id, context, workspaceId);
    if (!deleted) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") ||
      err.message.includes("Unauthorized") ||
      err.message.includes("READ-ONLY")
        ? 403
        : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
