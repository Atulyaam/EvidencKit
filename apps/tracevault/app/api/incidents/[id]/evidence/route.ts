import { NextRequest, NextResponse } from "next/server";
import {
  defaultEvidenceUploadService,
  defaultIncidentService,
  evaluateSessionContext,
  validateCsrfProtection,
  requireWorkspaceAuthorization
} from "@evidencekit/evidence-server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = evaluateSessionContext(request.headers);
    validateCsrfProtection(request.headers, context);

    const incident = await defaultIncidentService.getIncident(params.id);
    if (!incident) {
      return NextResponse.json({ error: `Incident '${params.id}' not found` }, { status: 404 });
    }
    requireWorkspaceAuthorization(context, incident.workspaceId);

    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get("preview") === "true";

    const formData: any = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided in form data" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (isPreview) {
      const preview = await defaultEvidenceUploadService.previewUpload(file.name, buffer);
      return NextResponse.json(preview);
    }

    const result = await defaultEvidenceUploadService.importUpload(
      params.id,
      file.name,
      buffer,
      context
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") || err.message.includes("READ-ONLY")
        ? 403
        : err.message.includes("CSRF")
          ? 403
          : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
