import { NextRequest, NextResponse } from "next/server";
import { defaultEvidenceGraphService, evaluateSessionContext } from "@evidencekit/evidence-server";
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

    const streamId = searchParams.get("streamId") || undefined;
    const relationshipType =
      (searchParams.get("relationshipType") as "all" | "explicit" | "inferred") || "all";
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    let db;
    try {
      db = getDb();
    } catch {
      // In-memory fallback
    }

    const graph = await defaultEvidenceGraphService.getEvidenceGraph(
      {
        workspaceId,
        streamId,
        relationshipType,
        search,
        limit
      },
      db,
      context
    );

    return NextResponse.json(graph);
  } catch (err: any) {
    const status =
      err?.message?.includes("Forbidden") || err?.message?.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to retrieve evidence graph" },
      { status }
    );
  }
}
