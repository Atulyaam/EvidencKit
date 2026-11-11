import { NextRequest, NextResponse } from "next/server";
import {
  defaultChainService,
  defaultExportBundleService,
  defaultAgentSessionService,
  evaluateSessionContext,
  requireWorkspaceAuthorization
} from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(req.headers);
    const db = getDb();
    const session = await defaultAgentSessionService.getSession(
      params.id,
      "ws_demo_default",
      db,
      context
    );
    if (!session) {
      return NextResponse.json({ error: `Session '${params.id}' not found` }, { status: 404 });
    }
    requireWorkspaceAuthorization(context, session.workspaceId);

    const allEvents = await defaultChainService.getAllEvents(params.id, db);

    if (allEvents.length === 0) {
      return NextResponse.json(
        { error: `Session '${params.id}' has no recorded events to export` },
        { status: 404 }
      );
    }

    const bundle = await defaultExportBundleService.exportBundleJson(params.id);

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
    const status =
      error.message?.includes("Forbidden") || error.message?.includes("READ-ONLY") ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to generate export bundle" },
      { status }
    );
  }
}
