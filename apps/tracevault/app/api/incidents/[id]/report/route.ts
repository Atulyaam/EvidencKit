import { NextRequest, NextResponse } from "next/server";
import {
  defaultIncidentService,
  defaultChainService,
  defaultReportService
} from "@evidencekit/evidence-server";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    const incident = await defaultIncidentService.getIncident(params.id);
    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

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
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
