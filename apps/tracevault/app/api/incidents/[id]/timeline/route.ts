import { NextRequest, NextResponse } from "next/server";
import {
  defaultChainService,
  defaultIncidentService,
  evaluateSessionContext,
  requireWorkspaceAuthorization
} from "@evidencekit/evidence-server";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(request.headers);
    const incident = await defaultIncidentService.getIncident(params.id);
    if (!incident) {
      return NextResponse.json({ error: `Incident '${params.id}' not found` }, { status: 404 });
    }
    requireWorkspaceAuthorization(context, incident.workspaceId);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const severity = (searchParams.get("severity") as any) || undefined;
    const system = searchParams.get("system") || undefined;
    const eventName = searchParams.get("eventName") || undefined;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : 0;

    const result = defaultChainService.queryTimelineInMemory(params.id, {
      search,
      severity,
      system,
      eventName,
      limit,
      offset
    });

    const verification = defaultChainService.verifyInMemory(params.id);

    return NextResponse.json({
      ...result,
      verification
    });
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") || err.message.includes("READ-ONLY") ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
