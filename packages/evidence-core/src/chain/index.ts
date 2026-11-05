import { createHash } from "node:crypto";
import { canonicalizeJson } from "../canonicalize/index";
import { EvidenceEvent } from "../schema/index";

export const INITIAL_PREVIOUS_HASH = "0".repeat(64);
export const DOMAIN_PREFIX = "EvidenceKit:event:v1\n";

/**
 * Decodes a 64-character lowercase hex string into a 32-byte Uint8Array.
 */
export function hexDecode(hex: string): Uint8Array {
  if (hex.length !== 64 || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error(`Invalid 64-character hex string: ${hex}`);
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Encodes a Uint8Array into a lowercase hex string.
 */
export function hexEncode(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    hex += b < 16 ? "0" + b.toString(16) : b.toString(16);
  }
  return hex;
}

/**
 * Computes the event hash according to the EvidenceKit specification:
 * hash_input_i = UTF8("EvidenceKit:event:v1\n") || HEX_DECODE(previous_hash_i) || UTF8("\n") || UTF8(canonical_event_i)
 * event_hash_i = SHA256(hash_input_i)
 */
export function computeEventHash(event: EvidenceEvent, previousHash: string): string {
  const canonicalEventJson = canonicalizeJson(event);
  const prefixBytes = new TextEncoder().encode(DOMAIN_PREFIX);
  const prevHashBytes = hexDecode(previousHash.toLowerCase());
  const newlineBytes = new TextEncoder().encode("\n");
  const eventBytes = new TextEncoder().encode(canonicalEventJson);

  const totalLength =
    prefixBytes.length + prevHashBytes.length + newlineBytes.length + eventBytes.length;
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  combined.set(prefixBytes, offset);
  offset += prefixBytes.length;

  combined.set(prevHashBytes, offset);
  offset += prevHashBytes.length;

  combined.set(newlineBytes, offset);
  offset += newlineBytes.length;

  combined.set(eventBytes, offset);

  const hash = createHash("sha256").update(combined).digest("hex");
  return hash.toLowerCase();
}

export interface VerificationResult {
  status: "verified" | "failed" | "unanchored" | "incomplete";
  stream_id: string;
  total_events: number;
  first_sequence?: number;
  last_sequence?: number;
  head_hash?: string;
  verified_at: string;
  error?: string;
  failed_at_sequence?: number;
}

export interface ChainedEvent {
  event: EvidenceEvent;
  stream_sequence: number;
  previous_hash: string;
  event_hash: string;
}

/**
 * Verifies an ordered sequence of chained events from sequence 0..N against previous_hash continuity and SHA-256 hashes.
 */
export function verifyEventChain(
  events: ChainedEvent[],
  expectedHeadHash?: string
): VerificationResult {
  const now = new Date().toISOString();

  if (events.length === 0) {
    return {
      status: "unanchored",
      stream_id: "unknown",
      total_events: 0,
      verified_at: now,
      error: "No events provided in stream"
    };
  }

  const streamId = events[0]!.event.stream_id;

  let expectedPreviousHash = INITIAL_PREVIOUS_HASH;

  for (let i = 0; i < events.length; i++) {
    const current = events[i]!;

    // 1. Verify stream id consistency
    if (current.event.stream_id !== streamId) {
      return {
        status: "failed",
        stream_id: streamId,
        total_events: events.length,
        failed_at_sequence: current.stream_sequence,
        verified_at: now,
        error: `Stream ID mismatch at sequence ${current.stream_sequence}: expected ${streamId}, found ${current.event.stream_id}`
      };
    }

    // 2. Verify sequence continuity
    if (current.stream_sequence !== i) {
      return {
        status: "failed",
        stream_id: streamId,
        total_events: events.length,
        failed_at_sequence: current.stream_sequence,
        verified_at: now,
        error: `Sequence discontinuity at index ${i}: expected sequence ${i}, found ${current.stream_sequence}`
      };
    }

    // 3. Verify previous hash
    if (current.previous_hash.toLowerCase() !== expectedPreviousHash.toLowerCase()) {
      return {
        status: "failed",
        stream_id: streamId,
        total_events: events.length,
        failed_at_sequence: current.stream_sequence,
        verified_at: now,
        error: `Previous hash mismatch at sequence ${current.stream_sequence}: expected ${expectedPreviousHash}, found ${current.previous_hash}`
      };
    }

    // 4. Recompute event hash
    const computedHash = computeEventHash(current.event, current.previous_hash);
    if (computedHash.toLowerCase() !== current.event_hash.toLowerCase()) {
      return {
        status: "failed",
        stream_id: streamId,
        total_events: events.length,
        failed_at_sequence: current.stream_sequence,
        verified_at: now,
        error: `Event hash mismatch at sequence ${current.stream_sequence}: computed ${computedHash}, recorded ${current.event_hash}`
      };
    }

    expectedPreviousHash = current.event_hash;
  }

  const lastEvent = events[events.length - 1]!;

  // 5. If an expected head hash is provided, verify it matches the last event's hash
  if (expectedHeadHash && expectedHeadHash.toLowerCase() !== lastEvent.event_hash.toLowerCase()) {
    return {
      status: "failed",
      stream_id: streamId,
      total_events: events.length,
      failed_at_sequence: lastEvent.stream_sequence,
      head_hash: lastEvent.event_hash,
      verified_at: now,
      error: `Chain head hash mismatch: expected ${expectedHeadHash}, found ${lastEvent.event_hash}`
    };
  }

  return {
    status: "verified",
    stream_id: streamId,
    total_events: events.length,
    first_sequence: events[0]!.stream_sequence,
    last_sequence: lastEvent.stream_sequence,
    head_hash: lastEvent.event_hash,
    verified_at: now
  };
}
