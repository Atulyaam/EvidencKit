import { NextRequest, NextResponse } from "next/server";
import { defaultChainService } from "@evidencekit/evidence-server";
import { createExportBundle } from "@evidencekit/core";
import { getDb } from "@evidencekit/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const allEvents = await defaultChainService.getAllEvents(params.id, db);

    if (allEvents.length === 0) {
      return NextResponse.json(
        { error: `Session '${params.id}' has no recorded events to export` },
        { status: 404 }
      );
    }

    const bundle = createExportBundle(params.id, "agentledger.session", allEvents);

    const download = req.nextUrl.searchParams.get("download");
    if (download === "true") {
      const jsonStr = JSON.stringify(bundle, null, 2);
      return new NextResponse(jsonStr, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="agentledger-session-${params.id}.json"`
        }
      });
    }

    return NextResponse.json(bundle);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate export bundle" },
      { status: 500 }
    );
  }
}
