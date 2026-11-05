import { createHash } from "node:crypto";
import { EvidenceReference } from "../schema/index";

export interface ArtifactMetadata {
  id: string;
  stream_id: string;
  filename: string;
  media_type: string;
  size_bytes: number;
  sha256: string;
  storage_key?: string;
  retained_at?: string;
}

/**
 * Computes SHA-256 hex digest for binary/text artifact buffer.
 */
export function computeArtifactDigest(content: Uint8Array | Buffer | string): string {
  const hash = createHash("sha256");
  if (typeof content === "string") {
    hash.update(content, "utf8");
  } else {
    hash.update(content);
  }
  return hash.digest("hex").toLowerCase();
}

/**
 * Creates a structured evidence reference pointer.
 */
export function createEvidenceRef(
  artifactId: string,
  locatorType: "line_number" | "json_pointer" | "byte_range" | "record_number",
  locator: string | number
): EvidenceReference {
  return {
    artifact_id: artifactId,
    locator_type: locatorType,
    locator: String(locator)
  };
}
