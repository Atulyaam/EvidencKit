import { NextRequest, NextResponse } from "next/server";
import { defaultEvidenceQualityService } from "@evidencekit/evidence-server";
import { getDb } from "@evidencekit/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
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
    return NextResponse.json(
      { error: err?.message || "Failed to generate quality report" },
      { status: 500 }
    );
  }
}
