import { NextRequest, NextResponse } from "next/server";
import {
  defaultExportBundleService,
  defaultIncidentService,
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

    if (format === "zip") {
      const zipBuffer = await defaultExportBundleService.exportBundleZip(params.id);
      return new NextResponse(new Uint8Array(zipBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="incident-${params.id}-evidence-bundle.zip"`
        }
      });
    }

    const jsonBundle = await defaultExportBundleService.exportBundleJson(params.id);
    return new NextResponse(JSON.stringify(jsonBundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="incident-${params.id}-evidence-bundle.json"`
      }
    });
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") || err.message.includes("READ-ONLY") ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
