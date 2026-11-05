import { NextRequest, NextResponse } from "next/server";
import { defaultChainService } from "@evidencekit/evidence-server";
import { discoverCorrelations } from "@evidencekit/core";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
