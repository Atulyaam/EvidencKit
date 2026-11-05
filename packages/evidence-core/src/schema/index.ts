import { z } from "zod";

export const TimeConfidenceSchema = z.enum(["source_timestamp", "inferred", "ingestion_fallback"]);
export type TimeConfidence = z.infer<typeof TimeConfidenceSchema>;

export const EventSeveritySchema = z.enum(["debug", "info", "warning", "error", "critical"]);
export type EventSeverity = z.infer<typeof EventSeveritySchema>;

export const StreamTypeSchema = z.enum(["tracevault.case", "agentledger.session"]);
export type StreamType = z.infer<typeof StreamTypeSchema>;

export const EvidenceSourceSchema = z.object({
  system: z.string().min(1).max(128),
  artifact_id: z.string().max(128).optional(),
  adapter: z.string().min(1).max(128),
  adapter_version: z.string().min(1).max(64)
});
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const EventActorSchema = z.object({
  type: z.string().min(1).max(64),
  id: z.string().max(128).optional()
});
export type EventActor = z.infer<typeof EventActorSchema>;

export const EvidenceReferenceSchema = z.object({
  artifact_id: z.string().min(1).max(128),
  locator_type: z.enum(["line_number", "json_pointer", "byte_range", "record_number"]),
  locator: z.string().min(1).max(256)
});
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;

export const EvidenceEventSchema = z.object({
  schema_version: z.literal("1.0"),
  event_id: z.string().uuid(),
  stream_type: StreamTypeSchema,
  stream_id: z.string().min(1).max(128),
  event_name: z.string().min(1).max(128),
  occurred_at: z.string().datetime().nullable(),
  observed_at: z.string().datetime(),
  time_confidence: TimeConfidenceSchema,
  source: EvidenceSourceSchema,
  actor: EventActorSchema.optional(),
  severity: EventSeveritySchema,
  correlation_ids: z.array(z.string().max(128)).max(32).optional(),
  attributes: z.record(z.string(), z.unknown()),
  evidence_refs: z.array(EvidenceReferenceSchema).max(64).optional()
});
export type EvidenceEvent = z.infer<typeof EvidenceEventSchema>;

export const ChainMetadataSchema = z.object({
  stream_id: z.string(),
  stream_sequence: z.number().int().nonnegative(),
  previous_hash: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/),
  event_hash: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/),
  hash_algorithm: z.literal("sha-256"),
  canonicalization: z.literal("RFC8785-JCS")
});
export type ChainMetadata = z.infer<typeof ChainMetadataSchema>;
