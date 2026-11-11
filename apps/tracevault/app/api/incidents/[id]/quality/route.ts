import { NextRequest, NextResponse } from "next/server";
import {
  defaultEvidenceQualityService,
  defaultIncidentService,
  evaluateSessionContext,
  requireWorkspaceAuthorization
} from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(req.headers);
    const incident = await defaultIncidentService.getIncident(params.id);
    if (!incident) {
      return NextResponse.json({ error: `Incident '${params.id}' not found` }, { status: 404 });
    }
    requireWorkspaceAuthorization(context, incident.workspaceId);

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

    let db;
    try {
      db = getDb();
    } catch {
      // In-memory fallback
    }

    const report = await defaultEvidenceQualityService.getQualityReport(id, db);

    if (format === "markdown") {
      const markdown = defaultEvidenceQualityService.generateMarkdownQualityReport(report);
      return new NextResponse(markdown, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="evidence-quality-${id}.md"`
        }
      });
    }

    return NextResponse.json(report);
  } catch (err: any) {
    const status =
      err.message?.includes("Forbidden") || err.message?.includes("READ-ONLY") ? 403 : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to generate quality report" },
      { status }
    );
  }
}
