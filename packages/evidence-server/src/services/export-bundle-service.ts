import JSZip from "jszip";
import {
  createExportBundle,
  validateImportBundle,
  EvidenceExportBundle,
  ImportValidationResult,
  ChainedEvent,
  generateEd25519KeyPair,
  KeyPairResult
} from "@evidencekit/core";
import { defaultChainService, ChainService } from "./chain-service";

export class ExportBundleService {
  private signingKeyPair: KeyPairResult;

  constructor(private chainService: ChainService = defaultChainService) {
    // Initialize default server-side Ed25519 signing key pair
    this.signingKeyPair = generateEd25519KeyPair("ek-signer-prod-2026");
  }

  /**
   * Returns the server's public key metadata for independent verification.
   * Private keys are strictly retained on the server.
   */
  public getSigningPublicKey() {
    return {
      algorithm: "Ed25519",
      keyId: this.signingKeyPair.keyId,
      publicKeyBase64: this.signingKeyPair.publicKeyBase64,
      fingerprint: this.signingKeyPair.fingerprint
    };
  }

  /**
   * Generates an independently verifiable portable JSON export bundle.
   * By default, signs the manifest canonically using Ed25519.
   */
  public async exportBundleJson(
    streamId: string,
    options?: { sign?: boolean; workspaceId?: string }
  ): Promise<EvidenceExportBundle> {
    const events = await this.chainService.getAllEvents(streamId);
    const streamType = events.length > 0 ? events[0]!.event.stream_type : "tracevault.case";
    const shouldSign = options?.sign !== false;

    return createExportBundle(streamId, streamType, events, {
      workspaceId: options?.workspaceId || "default",
      signingKey: shouldSign
        ? {
            privateKeyBase64: this.signingKeyPair.privateKeyBase64,
            publicKeyBase64: this.signingKeyPair.publicKeyBase64,
            keyId: this.signingKeyPair.keyId
          }
        : undefined
    });
  }

  /**
   * Generates a portable ZIP archive containing manifest.json, signature.json (if signed),
   * events.jsonl, and verification_report.json.
   */
  public async exportBundleZip(
    streamId: string,
    options?: { sign?: boolean; workspaceId?: string }
  ): Promise<Buffer> {
    const bundle = await this.exportBundleJson(streamId, options);
    const zip = new JSZip();

    zip.file("manifest.json", JSON.stringify(bundle.manifest, null, 2));
    if (bundle.signature) {
      zip.file("signature.json", JSON.stringify(bundle.signature, null, 2));
    }
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
Format Version: ${bundle.manifest.format_version}
Created At: ${bundle.manifest.created_at}
Events: ${bundle.manifest.event_count}
Chain Head SHA-256: ${bundle.manifest.chain_head_hash}
Digital Signature: ${bundle.signature ? `Ed25519 (Key ID: ${bundle.signature.key_id})` : "Unsigned"}

Integrity Guarantee:
Each event in events.jsonl is canonically serialized using RFC 8785 (JCS) and linked via SHA-256
hash-chaining. Any retroactive modification, reordering, insertion, or deletion breaks the cryptographic chain.
${
  bundle.signature
    ? `The manifest is cryptographically signed using Ed25519 (Public Key Fingerprint: ${bundle.signature.public_key_fingerprint}).`
    : ""
}

To independently verify this bundle:
1. Parse manifest.json and events.jsonl.
2. For each event starting from sequence 0, compute SHA-256(RFC8785(event) + previous_hash).
3. Confirm each event_hash matches the computed hash, and final head matches manifest.chain_head_hash.
4. Verify signature.json against manifest.json using Ed25519 public key.
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
   * Validates and verifies an imported ZIP archive containing manifest.json, signature.json, and events.jsonl.
   */
  public async verifyZipBundle(zipBuffer: Buffer): Promise<ImportValidationResult> {
    const zip = await JSZip.loadAsync(zipBuffer);
    const manifestFile = zip.file("manifest.json");
    const eventsFile = zip.file("events.jsonl");
    const signatureFile = zip.file("signature.json");

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
        signature_verification: {
          valid: false,
          status: "error",
          error: "Missing manifest.json in ZIP archive",
          disclaimer: "Signature could not be evaluated."
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
        signature_verification: {
          valid: false,
          status: "error",
          error: "Missing events.jsonl in ZIP archive",
          disclaimer: "Signature could not be evaluated."
        },
        artifact_errors: [],
        errors: ["Missing events.jsonl in ZIP archive"]
      };
    }

    const manifestText = await manifestFile.async("string");
    const eventsText = await eventsFile.async("string");
    let signatureJson: unknown = undefined;

    if (signatureFile) {
      try {
        const sigText = await signatureFile.async("string");
        signatureJson = JSON.parse(sigText);
      } catch {
        // ignore
      }
    }

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
        signature_verification: {
          valid: false,
          status: "error",
          error: `Malformed manifest.json: ${e.message}`,
          disclaimer: "Signature could not be evaluated."
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
          signature_verification: {
            valid: false,
            status: "error",
            error: `Malformed events.jsonl at line ${i + 1}: ${e.message}`,
            disclaimer: "Signature could not be evaluated."
          },
          artifact_errors: [],
          errors: [`Malformed events.jsonl at line ${i + 1}: ${e.message}`]
        };
      }
    }

    return validateImportBundle({
      manifest: manifestJson,
      signature: signatureJson,
      events: parsedEvents
    });
  }
}

export const defaultExportBundleService = new ExportBundleService();
