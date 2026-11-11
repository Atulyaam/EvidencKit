import { NextRequest, NextResponse } from "next/server";
import { validateImportBundle } from "@evidencekit/core";

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 20971520) {
      return NextResponse.json(
        {
          valid: false,
          error: "Payload exceeds maximum allowed bundle size (20MB)",
          errors: ["Payload Too Large (max 20MB)"]
        },
        { status: 413 }
      );
    }

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
