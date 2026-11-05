# EvidenceKit — Event Model Steering Rules

1. Canonical envelope schema conforms to version 1.0.
2. Required fields:
   - `schema_version`: "1.0"
   - `event_id`: UUID string
   - `stream_type`: "tracevault.case" | "agentledger.session"
   - `stream_id`: string
   - `event_name`: string (max 128 chars)
   - `occurred_at`: ISO timestamp string | null
   - `observed_at`: ISO timestamp string
   - `time_confidence`: "source_timestamp" | "inferred" | "ingestion_fallback"
   - `source`: { system, adapter, adapter_version, artifact_id? }
   - `severity`: "debug" | "info" | "warning" | "error" | "critical"
   - `attributes`: Record<string, unknown> (bounded to 64KB)
   - `evidence_refs`: Array<{ artifact_id, locator_type, locator }>
3. Mutable chain metadata (`stream_sequence`, `previous_hash`, `event_hash`) is stored outside the canonical envelope.
