# Kiro Spec: Canonicalization and Hash Chain

- Deterministic RFC 8785 JSON Canonicalization Scheme.
- SHA-256 chain formula:
  `canonical_event_i = JCS(envelope_i)`
  `hash_input_i = UTF8("EvidenceKit:event:v1\n") || HEX_DECODE(previous_hash_i) || UTF8("\n") || UTF8(canonical_event_i)`
  `event_hash_i = SHA256(hash_input_i)`
- Stream head locking for concurrency safety.
- Tamper detection for mutations, insertions, deletions, and re-orderings.
