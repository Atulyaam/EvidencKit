import { NextRequest, NextResponse } from "next/server";
import {
  defaultChainService,
  defaultIncidentService,
  evaluateSessionContext,
  requireWorkspaceAuthorization
} from "@evidencekit/evidence-server";
import { discoverCorrelations } from "@evidencekit/core";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(request.headers);
    const incident = await defaultIncidentService.getIncident(params.id);
    if (!incident) {
      return NextResponse.json({ error: `Incident '${params.id}' not found` }, { status: 404 });
    }
    requireWorkspaceAuthorization(context, incident.workspaceId);

    const { searchParams } = new URL(request.url);
    const windowSeconds = searchParams.get("windowSeconds")
      ? Number(searchParams.get("windowSeconds"))
      : 900;

    const events = defaultChainService.getEventsInMemory(params.id);
    const correlations = discoverCorrelations(events, { windowSeconds });

    return NextResponse.json({
      incidentId: params.id,
      totalEvents: events.length,
      correlations
    });
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") || err.message.includes("READ-ONLY") ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
