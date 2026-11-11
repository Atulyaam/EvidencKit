import { NextRequest, NextResponse } from "next/server";
import {
  defaultIncidentService,
  evaluateSessionContext,
  validateCsrfProtection
} from "@evidencekit/evidence-server";

export async function GET(request: NextRequest) {
  try {
    const context = evaluateSessionContext(request.headers);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const status = (searchParams.get("status") as any) || undefined;
    const severity = (searchParams.get("severity") as any) || undefined;
    const environment = searchParams.get("environment") || undefined;
    const workspaceId = searchParams.get("workspaceId") || "ws_demo_default";
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 20;
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : 0;

    const result = await defaultIncidentService.listIncidents(
      {
        search,
        status,
        severity,
        environment,
        workspaceId,
        limit,
        offset
      },
      workspaceId,
      undefined,
      context
    );

    return NextResponse.json(result);
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") || err.message.includes("Unauthorized") ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = evaluateSessionContext(request.headers);
    validateCsrfProtection(request.headers, context);
    const body = await request.json();

    const incident = await defaultIncidentService.createIncident(body, context);
    return NextResponse.json(incident, { status: 201 });
  } catch (err: any) {
    const status =
      err.message.includes("Forbidden") ||
      err.message.includes("Unauthorized") ||
      err.message.includes("READ-ONLY")
        ? 403
        : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
