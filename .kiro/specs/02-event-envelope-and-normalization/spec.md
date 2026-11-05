# Kiro Spec: Event Envelope and Normalization

- Canonical Envelope v1.0 defined with strict Zod types.
- Dual timestamps: occurred_at (source event time) and observed_at (ingestion time).
- Time confidence enum: source_timestamp, inferred, ingestion_fallback.
- Source adapters retain artifact references and JSON pointer / line number locators.
