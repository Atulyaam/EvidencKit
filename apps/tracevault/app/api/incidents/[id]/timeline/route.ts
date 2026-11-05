import { NextRequest, NextResponse } from "next/server";
import { defaultChainService } from "@evidencekit/evidence-server";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const severity = (searchParams.get("severity") as any) || undefined;
    const system = searchParams.get("system") || undefined;
    const eventName = searchParams.get("eventName") || undefined;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : 0;

    const result = defaultChainService.queryTimelineInMemory(params.id, {
      search,
      severity,
      system,
      eventName,
      limit,
      offset
    });

    const verification = defaultChainService.verifyInMemory(params.id);

    return NextResponse.json({
      ...result,
      verification
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
