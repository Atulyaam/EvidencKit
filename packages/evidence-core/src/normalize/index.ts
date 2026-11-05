import { randomUUID } from "node:crypto";
import {
  EvidenceEvent,
  EvidenceEventSchema,
  EvidenceReference,
  EventSeverity,
  StreamType
} from "../schema/index";
import { sanitizeData } from "../redact/index";

export interface RawEventInput {
  event_id?: string;
  stream_type: StreamType;
  stream_id: string;
  event_name: string;
  occurred_at?: string | Date | null;
  observed_at?: string | Date;
  time_confidence?: "source_timestamp" | "inferred" | "ingestion_fallback";
  source: {
    system: string;
    artifact_id?: string;
    adapter: string;
    adapter_version: string;
  };
  actor?: {
    type: string;
    id?: string;
  };
  severity?: EventSeverity;
  correlation_ids?: string[];
  attributes?: Record<string, unknown>;
  evidence_refs?: EvidenceReference[];
}

/**
 * Normalizes raw input into a validated EvidenceEvent envelope.
 * Automatically sanitizes secrets from attributes and enforces schema invariants.
 */
export function normalizeEvent(input: RawEventInput): EvidenceEvent {
  const observedAt = input.observed_at
    ? (typeof input.observed_at === "string"
        ? new Date(input.observed_at)
        : input.observed_at
      ).toISOString()
    : new Date().toISOString();

  let occurredAt: string | null = null;
  let timeConfidence = input.time_confidence;

  if (input.occurred_at) {
    try {
      const parsedDate =
        typeof input.occurred_at === "string" ? new Date(input.occurred_at) : input.occurred_at;
      if (!isNaN(parsedDate.getTime())) {
        occurredAt = parsedDate.toISOString();
        if (!timeConfidence) {
          timeConfidence = "source_timestamp";
        }
      }
    } catch {
      occurredAt = null;
    }
  }

  if (!occurredAt) {
    occurredAt = null;
    timeConfidence = timeConfidence || "ingestion_fallback";
  }

  // Pre-persistence secret sanitization
  const rawAttributes = input.attributes ?? {};
  const { sanitized: sanitizedAttributes } = sanitizeData(rawAttributes);

  const rawEnvelope = {
    schema_version: "1.0" as const,
    event_id: input.event_id || randomUUID(),
    stream_type: input.stream_type,
    stream_id: input.stream_id,
    event_name: input.event_name,
    occurred_at: occurredAt,
    observed_at: observedAt,
    time_confidence: timeConfidence || "ingestion_fallback",
    source: input.source,
    actor: input.actor,
    severity: input.severity || "info",
    correlation_ids: input.correlation_ids || [],
    attributes: sanitizedAttributes,
    evidence_refs: input.evidence_refs || []
  };

  return EvidenceEventSchema.parse(rawEnvelope);
}
