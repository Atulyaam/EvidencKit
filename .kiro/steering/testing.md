# EvidenceKit — Testing Steering Rules

1. Unit tests: Fast execution (<30s) testing schemas, normalization, redaction, JCS, and chain hashing.
2. Property-based tests: Use `fast-check` to verify RFC 8785 determinism, chain invariants, sorting stability, and round-trip export validity.
3. Integration tests: Transactional append, concurrency conflict handling, tampering detection.
4. No test skipping, no weakened assertions, no suppressed failures.
