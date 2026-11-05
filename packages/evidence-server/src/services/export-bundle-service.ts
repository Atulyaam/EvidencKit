import JSZip from "jszip";
import {
  createExportBundle,
  validateImportBundle,
  EvidenceExportBundle,
  ImportValidationResult,
  ChainedEvent
} from "@evidencekit/core";
import { defaultChainService, ChainService } from "./chain-service";

export class ExportBundleService {
  constructor(private chainService: ChainService = defaultChainService) {}

  /**
   * Generates a portable JSON export bundle.
   */
  public async exportBundleJson(streamId: string): Promise<EvidenceExportBundle> {
    const events = await this.chainService.getAllEvents(streamId);
    const streamType = events.length > 0 ? events[0]!.event.stream_type : "tracevault.case";
    return createExportBundle(streamId, streamType, events);
  }

  /**
   * Generates a portable ZIP archive containing manifest.json, events.jsonl, and verification_report.json.
   */
  public async exportBundleZip(streamId: string): Promise<Buffer> {
    const bundle = await this.exportBundleJson(streamId);
    const zip = new JSZip();

    zip.file("manifest.json", JSON.stringify(bundle.manifest, null, 2));
    zip.file(
      "events.jsonl",
      bundle.events.map((e) => JSON.stringify(e)).join("\n") +
        (bundle.events.length > 0 ? "\n" : "")
    );
    zip.file("verification_report.json", JSON.stringify(bundle.verification_report, null, 2));
    zip.file(
      "README.txt",
      `EvidenceKit Portable Incident Evidence Bundle
Stream ID: ${bundle.manifest.stream_id}
Created At: ${bundle.manifest.created_at}
Events: ${bundle.manifest.event_count}
Chain Head SHA-256: ${bundle.manifest.chain_head_hash}

Integrity Guarantee:
Each event in events.jsonl is canonically serialized using RFC 8785 (JCS) and linked via SHA-256
hash-chaining. Any retroactive modification, reordering, insertion, or deletion breaks the cryptographic chain.

To independently verify this bundle:
1. Parse manifest.json and events.jsonl.
2. For each event starting from sequence 0, compute SHA-256(RFC8785(event) + previous_hash).
3. Confirm each event_hash matches the computed hash, and final head matches manifest.chain_head_hash.
`
    );

    const content = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return content;
  }

  /**
   * Validates and verifies an imported JSON or raw object bundle.
   */
  public verifyBundle(bundleJson: unknown): ImportValidationResult {
    return validateImportBundle(bundleJson);
  }

  /**
   * Validates and verifies an imported ZIP archive containing manifest.json and events.jsonl.
   */
  public async verifyZipBundle(zipBuffer: Buffer): Promise<ImportValidationResult> {
    const zip = await JSZip.loadAsync(zipBuffer);
    const manifestFile = zip.file("manifest.json");
    const eventsFile = zip.file("events.jsonl");

    if (!manifestFile) {
      return {
        valid: false,
        manifest: {} as any,
        events: [],
        verification: {
          status: "failed",
          stream_id: "unknown",
          total_events: 0,
          verified_at: new Date().toISOString(),
          error: "Missing manifest.json in ZIP archive"
        },
        artifact_errors: [],
        errors: ["Missing manifest.json in ZIP archive"]
      };
    }

    if (!eventsFile) {
      return {
        valid: false,
        manifest: {} as any,
        events: [],
        verification: {
          status: "failed",
          stream_id: "unknown",
          total_events: 0,
          verified_at: new Date().toISOString(),
          error: "Missing events.jsonl in ZIP archive"
        },
        artifact_errors: [],
        errors: ["Missing events.jsonl in ZIP archive"]
      };
    }

    const manifestText = await manifestFile.async("string");
    const eventsText = await eventsFile.async("string");

    let manifestJson: unknown;
    try {
      manifestJson = JSON.parse(manifestText);
    } catch (e: any) {
      return {
        valid: false,
        manifest: {} as any,
        events: [],
        verification: {
          status: "failed",
          stream_id: "unknown",
          total_events: 0,
          verified_at: new Date().toISOString(),
          error: `Malformed manifest.json: ${e.message}`
        },
        artifact_errors: [],
        errors: [`Malformed manifest.json: ${e.message}`]
      };
    }

    const parsedEvents: ChainedEvent[] = [];
    const lines = eventsText.split("\n").filter((l) => l.trim().length > 0);
    for (let i = 0; i < lines.length; i++) {
      try {
        parsedEvents.push(JSON.parse(lines[i]!));
      } catch (e: any) {
        return {
          valid: false,
          manifest: manifestJson as any,
          events: [],
          verification: {
            status: "failed",
            stream_id: "unknown",
            total_events: 0,
            verified_at: new Date().toISOString(),
            error: `Malformed events.jsonl at line ${i + 1}: ${e.message}`
          },
          artifact_errors: [],
          errors: [`Malformed events.jsonl at line ${i + 1}: ${e.message}`]
        };
      }
    }

    return validateImportBundle({
      manifest: manifestJson,
      events: parsedEvents
    });
  }
}

export const defaultExportBundleService = new ExportBundleService();
