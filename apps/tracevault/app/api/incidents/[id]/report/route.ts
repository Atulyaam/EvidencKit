import { NextRequest, NextResponse } from "next/server";
import {
  defaultIncidentService,
  defaultChainService,
  defaultReportService,
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
    const format = searchParams.get("format") || "json";

    const events = defaultChainService.getEventsInMemory(params.id);
    const report = defaultReportService.generateReport(incident, events);

    if (format === "markdown") {
      const markdown = defaultReportService.reportToMarkdown(report);
      return new NextResponse(markdown, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="report-${params.id}.md"`
        }
      });
    }

    return NextResponse.json(report);
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") || err.message.includes("READ-ONLY") ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
