import { NextRequest, NextResponse } from "next/server";
import { defaultEvidenceGraphService } from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId =
      req.headers.get("x-workspace-id") || searchParams.get("workspaceId") || "default";
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
      db
    );

    return NextResponse.json(graph);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to retrieve evidence graph" },
      { status: 500 }
    );
  }
}
