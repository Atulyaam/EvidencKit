import { NextResponse } from "next/server";
import { getHealthStatus } from "@evidencekit/evidence-server";

export async function GET() {
  const status = getHealthStatus();
  return NextResponse.json(status);
}
