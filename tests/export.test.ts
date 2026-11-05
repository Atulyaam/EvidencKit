import { describe, it, expect } from "vitest";
import {
  createExportBundle,
  validateImportBundle,
  EvidenceEvent,
  ChainedEvent,
  computeEventHash,
  INITIAL_PREVIOUS_HASH,
  computeArtifactDigest
} from "@evidencekit/core";

describe("Phase 2 — Portable Export & Import Verification Bundle", () => {
  const streamId = "export-test-case-01";
  const event1: EvidenceEvent = {
    schema_version: "1.0",
    event_id: "00000000-0000-4000-8000-000000000001",
    stream_type: "tracevault.case",
    stream_id: streamId,
    event_name: "test.start",
    occurred_at: "2026-11-16T12:00:00.000Z",
    observed_at: "2026-11-16T12:00:01.000Z",
    time_confidence: "source_timestamp",
    source: {
      system: "test",
      artifact_id: "art_01",
      adapter: "test",
      adapter_version: "1.0.0"
    },
    severity: "info",
    attributes: { status: "started" },
    evidence_refs: []
  };

  const hash1 = computeEventHash(event1, INITIAL_PREVIOUS_HASH);
  const chained: ChainedEvent[] = [
    {
      event: event1,
      stream_sequence: 0,
      previous_hash: INITIAL_PREVIOUS_HASH,
      event_hash: hash1
    }
  ];

  const artifactBytes = Buffer.from("console.log('sample test code');\n", "utf8");
  const artifactDigest = computeArtifactDigest(artifactBytes);

  const artifacts = [
    {
      id: "art_01",
      stream_id: streamId,
      filename: "app.log",
      media_type: "text/plain",
      size_bytes: artifactBytes.length,
      sha256: artifactDigest
    }
  ];

  it("creates a compliant export bundle with manifest and verification report", () => {
    const bundle = createExportBundle(streamId, "tracevault.case", chained, artifacts);

    expect(bundle.manifest.format_name).toBe("evidencekit-export");
    expect(bundle.manifest.format_version).toBe("1.0");
    expect(bundle.manifest.stream_id).toBe(streamId);
    expect(bundle.manifest.event_count).toBe(1);
    expect(bundle.manifest.chain_head_hash).toBe(hash1);
    expect(bundle.manifest.artifact_manifest.length).toBe(1);
    expect(bundle.manifest.artifact_manifest[0]!.sha256).toBe(artifactDigest);
    expect(bundle.verification_report.status).toBe("verified");
  });

  it("validates and verifies a valid exported bundle with artifact verification", () => {
    const bundle = createExportBundle(streamId, "tracevault.case", chained, artifacts);

    const artifactMap = new Map<string, Uint8Array>([["art_01", artifactBytes]]);
    const result = validateImportBundle(bundle, artifactMap);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.artifact_errors.length).toBe(0);
    expect(result.verification.status).toBe("verified");
  });

  it("detects tampered artifact digest during import verification", () => {
    const bundle = createExportBundle(streamId, "tracevault.case", chained, artifacts);

    const corruptedBytes = Buffer.from("corrupted file bytes", "utf8");
    const artifactMap = new Map<string, Uint8Array>([["art_01", corruptedBytes]]);

    const result = validateImportBundle(bundle, artifactMap);
    expect(result.valid).toBe(false);
    expect(result.artifact_errors.length).toBe(1);
    expect(result.artifact_errors[0]).toContain("digest mismatch");
  });

  it("rejects invalid bundle manifest schema", () => {
    const invalidBundle = {
      manifest: { format_name: "wrong-format" },
      events: []
    };

    const result = validateImportBundle(invalidBundle);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
