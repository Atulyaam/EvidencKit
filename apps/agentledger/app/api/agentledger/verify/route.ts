import { NextRequest, NextResponse } from "next/server";
import { validateImportBundle } from "@evidencekit/core";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = validateImportBundle(body);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        valid: false,
        error: error.message || "Failed to verify bundle",
        errors: [error.message || "Invalid JSON bundle payload"]
      },
      { status: 400 }
    );
  }
}

