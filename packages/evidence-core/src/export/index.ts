import { z } from "zod";
import { ChainedEvent, VerificationResult, verifyEventChain } from "../chain/index";
import { EvidenceEventSchema, StreamType, StreamTypeSchema } from "../schema/index";
import { ArtifactMetadata, computeArtifactDigest } from "../provenance/index";
import {
  SignatureReceipt,
  SignatureReceiptSchema,
  signExportManifest,
  verifyManifestSignature,
  SignatureVerificationResult,
  TrustedKeyRegistry,
  VerifySignatureOptions,
  SIGNATURE_DISCLAIMER
} from "../signatures/index";

export const ExportManifestSchema = z.object({
  format_name: z.literal("evidencekit-export"),
  format_version: z.union([z.literal("1.0"), z.literal("2.0")]),
  export_id: z.string().optional(),
  stream_id: z.string().min(1),
  stream_type: StreamTypeSchema,
  workspace_id: z.string().optional(),
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
  signature?: SignatureReceipt;
  events: ChainedEvent[];
  verification_report: VerificationResult;
}

export interface CreateExportBundleOptions {
  artifacts?: ArtifactMetadata[];
  workspaceId?: string;
  signingKey?: {
    privateKeyBase64: string;
    publicKeyBase64: string;
    keyId: string;
  };
}

/**
 * Creates an EvidenceKit portable export bundle from chained events and artifacts.
 * If signing key is provided, produces an Ed25519 digitally signed bundle (format v2.0).
 */
export function createExportBundle(
  streamId: string,
  streamType: StreamType,
  events: ChainedEvent[],
  artifactsOrOptions: ArtifactMetadata[] | CreateExportBundleOptions = []
): EvidenceExportBundle {
  const verificationReport = verifyEventChain(events);

  let artifacts: ArtifactMetadata[] = [];
  let workspaceId: string | undefined;
  let signingKey: CreateExportBundleOptions["signingKey"];

  if (Array.isArray(artifactsOrOptions)) {
    artifacts = artifactsOrOptions;
  } else if (artifactsOrOptions && typeof artifactsOrOptions === "object") {
    artifacts = artifactsOrOptions.artifacts || [];
    workspaceId = artifactsOrOptions.workspaceId;
    signingKey = artifactsOrOptions.signingKey;
  }

  const manifest: ExportManifest = {
    format_name: "evidencekit-export",
    format_version: signingKey ? "2.0" : "1.0",
    export_id: signingKey ? `exp_${Date.now()}` : undefined,
    stream_id: streamId,
    stream_type: streamType,
    workspace_id: workspaceId,
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

  let signature: SignatureReceipt | undefined;
  if (signingKey) {
    signature = signExportManifest(
      manifest as unknown as Record<string, unknown>,
      signingKey.privateKeyBase64,
      signingKey.keyId,
      signingKey.publicKeyBase64
    );
  }

  return {
    manifest,
    signature,
    events,
    verification_report: verificationReport
  };
}

export interface ImportValidationResult {
  valid: boolean;
  manifest: ExportManifest;
  events: ChainedEvent[];
  verification: VerificationResult;
  signature_verification: SignatureVerificationResult;
  artifact_errors: string[];
  errors: string[];
}

export interface ValidateImportBundleOptions {
  artifacts?: Map<string, Uint8Array | Buffer>;
  trustedRegistry?: TrustedKeyRegistry;
  trustedPublicKeys?: string[];
  allowUnsigned?: boolean;
  requireTrustedSigner?: boolean;
}

/**
 * Validates and independently verifies an imported evidence bundle.
 * Validates manifest, event schema, SHA-256 chain, artifacts, and Ed25519 digital signature.
 * Prevents signature stripping (SEC-003) and enforces signer trust (SEC-002).
 */
export function validateImportBundle(
  bundleJson: unknown,
  artifactsOrOptions?: Map<string, Uint8Array | Buffer> | ValidateImportBundleOptions
): ImportValidationResult {
  const errors: string[] = [];
  const artifactErrors: string[] = [];

  let providedArtifacts: Map<string, Uint8Array | Buffer> | undefined;
  let verifyOptions: VerifySignatureOptions | undefined;

  if (artifactsOrOptions instanceof Map) {
    providedArtifacts = artifactsOrOptions;
  } else if (artifactsOrOptions && typeof artifactsOrOptions === "object") {
    providedArtifacts = artifactsOrOptions.artifacts;
    verifyOptions = {
      trustedRegistry: artifactsOrOptions.trustedRegistry,
      trustedPublicKeys: artifactsOrOptions.trustedPublicKeys,
      allowUnsigned: artifactsOrOptions.allowUnsigned,
      requireTrustedSigner: artifactsOrOptions.requireTrustedSigner
    };
  }

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
      signature_verification: {
        valid: false,
        status: "error",
        evidenceIntegrity: false,
        signatureValidity: false,
        signerTrusted: false,
        error: "Invalid bundle payload",
        disclaimer: "No signature could be evaluated."
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
      signature_verification: {
        valid: false,
        status: "error",
        evidenceIntegrity: false,
        signatureValidity: false,
        signerTrusted: false,
        error: "Missing events array",
        disclaimer: "Signature could not be evaluated."
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

  // 4. Ed25519 Digital signature verification
  const rawSig = raw.signature as SignatureReceipt | undefined;
  let signatureVerification: SignatureVerificationResult;

  if (
    manifest?.format_version &&
    manifest.format_version !== "1.0" &&
    manifest.format_version !== "2.0"
  ) {
    signatureVerification = {
      valid: false,
      status: "UNSUPPORTED_VERSION",
      evidenceIntegrity: false,
      signatureValidity: false,
      signerTrusted: false,
      error: `Unsupported bundle format_version: '${manifest.format_version}'. Supported versions are 1.0 and 2.0.`,
      disclaimer: SIGNATURE_DISCLAIMER
    };
    errors.push(signatureVerification.error!);
  } else if (rawSig) {
    const sigParse = SignatureReceiptSchema.safeParse(rawSig);
    if (!sigParse.success) {
      signatureVerification = {
        valid: false,
        status: "INVALID_SIGNATURE",
        evidenceIntegrity: verification.status === "verified",
        signatureValidity: false,
        signerTrusted: false,
        error: `Malformed signature receipt: ${sigParse.error.message}`,
        disclaimer: SIGNATURE_DISCLAIMER
      };
      errors.push(`Invalid signature receipt: ${sigParse.error.message}`);
    } else {
      signatureVerification = verifyManifestSignature(
        manifest as unknown as Record<string, unknown>,
        sigParse.data,
        verifyOptions
      );
      if (!signatureVerification.valid) {
        errors.push(`Digital signature verification failed: ${signatureVerification.error}`);
      }
    }
  } else if (manifest.format_version === "2.0") {
    // SEC-003: Signature stripping detected!
    signatureVerification = {
      valid: false,
      status: "UNSIGNED",
      evidenceIntegrity: verification.status === "verified",
      signatureValidity: false,
      signerTrusted: false,
      error:
        "Signature stripping detected: bundle manifest format_version is 2.0 but digital signature is missing",
      disclaimer: SIGNATURE_DISCLAIMER
    };
    if (signatureVerification.error) {
      errors.push(signatureVerification.error);
    }
  } else {
    // Legacy unsigned bundle v1.0
    signatureVerification = verifyManifestSignature(
      manifest as unknown as Record<string, unknown>,
      null,
      { allowUnsigned: verifyOptions?.allowUnsigned ?? true, ...verifyOptions }
    );
  }

  // 5. Validate artifact digests if files provided
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
    errors.length === 0 &&
    artifactErrors.length === 0 &&
    verification.status === "verified" &&
    (!rawSig || signatureVerification.valid);

  return {
    valid,
    manifest,
    events,
    verification,
    signature_verification: signatureVerification,
    artifact_errors: artifactErrors,
    errors
  };
}
