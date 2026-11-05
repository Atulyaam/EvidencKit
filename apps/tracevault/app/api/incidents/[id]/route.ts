import { NextRequest, NextResponse } from "next/server";
import { defaultIncidentService, evaluateSessionContext } from "@evidencekit/evidence-server";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const incident = await defaultIncidentService.getIncident(params.id);
    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }
    return NextResponse.json(incident);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(request.headers);
    const body = await request.json();

    const updated = await defaultIncidentService.updateIncident(params.id, body, context);
    return NextResponse.json(updated);
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") || err.message.includes("READ-ONLY") ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(request.headers);
    const deleted = await defaultIncidentService.deleteIncident(params.id, context);
    if (!deleted) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") || err.message.includes("READ-ONLY") ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
