import { NextRequest, NextResponse } from "next/server";
import { defaultExportBundleService } from "@evidencekit/evidence-server";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData: any = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No bundle file provided in form data" },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = file.name.toLowerCase();

      if (filename.endsWith(".zip")) {
        const result = await defaultExportBundleService.verifyZipBundle(buffer);
        return NextResponse.json(result);
      } else {
        const text = buffer.toString("utf-8");
        const json = JSON.parse(text);
        const result = defaultExportBundleService.verifyBundle(json);
        return NextResponse.json(result);
      }
    }

    // Direct JSON body
    const body = await request.json();
    const result = defaultExportBundleService.verifyBundle(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
