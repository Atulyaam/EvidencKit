import { z } from "zod";
import { ChainedEvent, VerificationResult, verifyEventChain } from "../chain/index";
import { EvidenceEventSchema, StreamType, StreamTypeSchema } from "../schema/index";
import { ArtifactMetadata, computeArtifactDigest } from "../provenance/index";

export const ExportManifestSchema = z.object({
  format_name: z.literal("evidencekit-export"),
  format_version: z.literal("1.0"),
  stream_id: z.string().min(1),
  stream_type: StreamTypeSchema,
  created_at: z.string().datetime(),
  event_count: z.number().int().nonnegative(),
  first_sequence: z.number().int().nonnegative().optional(),
  last_sequence: z.number().int().nonnegative().optional(),
  chain_head_hash: z.string().length(64),
  hash_algorithm: z.literal("sha-256"),
  canonicalization: z.literal("RFC8785-JCS"),
  artifact_manifest: z.array(
    z.object({
      id: z.string(),
      filename: z.string(),
      sha256: z.string().length(64),
      size_bytes: z.number().int().nonnegative()
    })
  )
});
export type ExportManifest = z.infer<typeof ExportManifestSchema>;

export interface EvidenceExportBundle {
  manifest: ExportManifest;
  events: ChainedEvent[];
  verification_report: VerificationResult;
}

/**
 * Creates an EvidenceKit portable export bundle from chained events and artifacts.
 */
export function createExportBundle(
  streamId: string,
  streamType: StreamType,
  events: ChainedEvent[],
  artifacts: ArtifactMetadata[] = []
): EvidenceExportBundle {
  const verificationReport = verifyEventChain(events);

  const manifest: ExportManifest = {
    format_name: "evidencekit-export",
    format_version: "1.0",
    stream_id: streamId,
    stream_type: streamType,
    created_at: new Date().toISOString(),
    event_count: events.length,
    first_sequence: events.length > 0 ? events[0]!.stream_sequence : undefined,
    last_sequence: events.length > 0 ? events[events.length - 1]!.stream_sequence : undefined,
    chain_head_hash: events.length > 0 ? events[events.length - 1]!.event_hash : "0".repeat(64),
    hash_algorithm: "sha-256",
    canonicalization: "RFC8785-JCS",
    artifact_manifest: artifacts.map((a) => ({
      id: a.id,
      filename: a.filename,
      sha256: a.sha256,
      size_bytes: a.size_bytes
    }))
  };

  return {
    manifest,
    events,
    verification_report: verificationReport
  };
}

export interface ImportValidationResult {
  valid: boolean;
  manifest: ExportManifest;
  events: ChainedEvent[];
  verification: VerificationResult;
  artifact_errors: string[];
  errors: string[];
}

/**
 * Validates and independently verifies an imported evidence bundle.
 */
export function validateImportBundle(
  bundleJson: unknown,
  providedArtifacts?: Map<string, Uint8Array | Buffer>
): ImportValidationResult {
  const errors: string[] = [];
  const artifactErrors: string[] = [];

  if (typeof bundleJson !== "object" || bundleJson === null) {
    return {
      valid: false,
      manifest: {} as ExportManifest,
      events: [],
      verification: {
        status: "failed",
        stream_id: "unknown",
        total_events: 0,
        verified_at: new Date().toISOString(),
        error: "Invalid bundle payload: expected object"
      },
      artifact_errors: [],
      errors: ["Bundle JSON must be an object"]
    };
  }

  const raw = bundleJson as Record<string, unknown>;

  // 1. Validate manifest
  const manifestParsed = ExportManifestSchema.safeParse(raw.manifest);
  if (!manifestParsed.success) {
    errors.push(
      ...manifestParsed.error.errors.map(
        (e) => `Manifest error: ${e.path.join(".")} - ${e.message}`
      )
    );
  }
  const manifest = manifestParsed.success ? manifestParsed.data : (raw.manifest as ExportManifest);

  // 2. Validate events array
  const rawEvents = raw.events;
  if (!Array.isArray(rawEvents)) {
    errors.push("Events must be an array");
    return {
      valid: false,
      manifest,
      events: [],
      verification: {
        status: "failed",
        stream_id: manifest.stream_id || "unknown",
        total_events: 0,
        verified_at: new Date().toISOString(),
        error: "Events is not an array"
      },
      artifact_errors: [],
      errors
    };
  }

  const events: ChainedEvent[] = [];
  for (let i = 0; i < rawEvents.length; i++) {
    const item = rawEvents[i];
    if (typeof item !== "object" || item === null) {
      errors.push(`Event at index ${i} is not an object`);
      continue;
    }
    const itemObj = item as Record<string, unknown>;
    const eventParsed = EvidenceEventSchema.safeParse(itemObj.event);
    if (!eventParsed.success) {
      errors.push(
        `Event at index ${i} failed envelope schema validation: ${eventParsed.error.message}`
      );
    }

    events.push({
      event: eventParsed.success ? eventParsed.data : (itemObj.event as any),
      stream_sequence: Number(itemObj.stream_sequence),
      previous_hash: String(itemObj.previous_hash),
      event_hash: String(itemObj.event_hash)
    });
  }

  // 3. Independent chain verification
  const verification = verifyEventChain(events, manifest.chain_head_hash);

  // 4. Validate artifact digests if files provided
  if (providedArtifacts && manifest.artifact_manifest) {
    for (const art of manifest.artifact_manifest) {
      const bytes = providedArtifacts.get(art.id);
      if (bytes) {
        const computedDigest = computeArtifactDigest(bytes);
        if (computedDigest.toLowerCase() !== art.sha256.toLowerCase()) {
          artifactErrors.push(
            `Artifact ${art.filename} (${art.id}) digest mismatch: expected ${art.sha256}, computed ${computedDigest}`
          );
        }
      }
    }
  }

  const valid =
    errors.length === 0 && artifactErrors.length === 0 && verification.status === "verified";

  return {
    valid,
    manifest,
    events,
    verification,
    artifact_errors: artifactErrors,
    errors
  };
}
