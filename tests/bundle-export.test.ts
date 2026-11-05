import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  defaultChainService,
  defaultExportBundleService
} from "../packages/evidence-server/src/index";
import { EvidenceEvent } from "../packages/evidence-core/src/index";

describe("ExportBundleService (Task 3.10)", () => {
  it("exports bundle in JSON and ZIP formats and independently verifies them", async () => {
    const streamId = "test-export-stream-1";

    const evt1: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_id: streamId,
      stream_type: "tracevault.case",
      event_name: "deploy.started",
      occurred_at: new Date("2026-11-05T10:00:00Z").toISOString(),
      observed_at: new Date("2026-11-05T10:00:01Z").toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "ci-cd",
        adapter: "deploy-adapter",
        adapter_version: "1.0.0"
      },
      severity: "info",
      attributes: { deploy_id: "dep-1" }
    };

    const evt2: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_id: streamId,
      stream_type: "tracevault.case",
      event_name: "deploy.failed",
      occurred_at: new Date("2026-11-05T10:05:00Z").toISOString(),
      observed_at: new Date("2026-11-05T10:05:01Z").toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "ci-cd",
        adapter: "deploy-adapter",
        adapter_version: "1.0.0"
      },
      severity: "critical",
      attributes: { deploy_id: "dep-1", error: "database connection timeout" }
    };

    defaultChainService.appendInMemory(evt1);
    defaultChainService.appendInMemory(evt2);

    // 1. JSON Export & Verify
    const jsonBundle = await defaultExportBundleService.exportBundleJson(streamId);
    expect(jsonBundle.manifest.format_name).toBe("evidencekit-export");
    expect(jsonBundle.manifest.event_count).toBe(2);
    expect(jsonBundle.events.length).toBe(2);
    expect(jsonBundle.verification_report.status).toBe("verified");

    const jsonVerifyResult = defaultExportBundleService.verifyBundle(jsonBundle);
    expect(jsonVerifyResult.valid).toBe(true);
    expect(jsonVerifyResult.verification.status).toBe("verified");
    expect(jsonVerifyResult.events.length).toBe(2);

    // 2. ZIP Export & Verify
    const zipBuffer = await defaultExportBundleService.exportBundleZip(streamId);
    expect(Buffer.isBuffer(zipBuffer)).toBe(true);
    expect(zipBuffer.length).toBeGreaterThan(100);

    const zipVerifyResult = await defaultExportBundleService.verifyZipBundle(zipBuffer);
    expect(zipVerifyResult.valid).toBe(true);
    expect(zipVerifyResult.verification.status).toBe("verified");
    expect(zipVerifyResult.manifest.stream_id).toBe(streamId);
    expect(zipVerifyResult.events.length).toBe(2);
  });

  it("detects tampering in imported JSON bundle", async () => {
    const streamId = "test-tamper-stream-2";

    const evt1: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_id: streamId,
      stream_type: "tracevault.case",
      event_name: "incident.created",
      occurred_at: new Date().toISOString(),
      observed_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "tracevault",
        adapter: "ui-form",
        adapter_version: "1.0.0"
      },
      severity: "info",
      attributes: { note: "initial state" }
    };

    defaultChainService.appendInMemory(evt1);
    const bundle = await defaultExportBundleService.exportBundleJson(streamId);

    // Tamper with event attributes in the export bundle without updating hash
    bundle.events[0]!.event.attributes = { note: "malicious alteration" };

    const verifyResult = defaultExportBundleService.verifyBundle(bundle);
    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.verification.status).toBe("failed");
    expect(verifyResult.verification.failed_at_sequence).toBe(0);
  });
});
