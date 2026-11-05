# EvidenceKit — Security Notes & Threat Model Analysis

**Date:** 2026-11-05  
**Reviewer:** Senior Security Engineer

---

## 1. Threat Model & Mitigations

### 1.1 Secret Leakage through Evidence Records

- **Threat:** Application logs, CI workflow variables, and agent tool execution arguments frequently contain sensitive credentials (e.g. OpenAI keys, GitHub PATs, database connection strings, SSH/RSA private keys).
- **Mitigation:**
  - Mandatory pre-persistence sanitization in `packages/evidence-core/src/redact`.
  - Detection patterns replace secrets with typed markers (`[REDACTED_API_KEY]`, `[REDACTED_AUTH_TOKEN]`, `[REDACTED_PASSWORD]`, `[REDACTED_PRIVATE_KEY]`, `[REDACTED_CONNECTION_STRING]`).
  - Redaction executes **prior** to RFC 8785 canonicalization and SHA-256 hash calculation. Captured and verified evidence remains free of raw credentials.

### 1.2 Tampering & Retroactive Log Modification

- **Threat:** An adversary modifies past log entries, removes incriminating deployment failures, or reorders agent actions to falsify an audit trail.
- **Mitigation:**
  - Cryptographic SHA-256 hash chaining: Each event hash is computed over `UTF8("EvidenceKit:event:v1\n") || HEX_DECODE(previous_hash) || UTF8("\n") || JCS(envelope)`.
  - Any modification, deletion, reordering, or insertion alters subsequent hashes and conflicts with the recorded stream head.
  - The verifier identifies the exact sequence number where tampering occurred.

### 1.3 Concurrency & Split-Brain Chains

- **Threat:** Rapid concurrent ingestion creates race conditions where two events claim the same sequence number, corrupting stream continuity.
- **Mitigation:**
  - Relational schema constraint: `UNIQUE (stream_id, ingest_sequence)`.
  - Transactional row-level lock: `SELECT ... FROM chain_heads WHERE stream_id = ? FOR UPDATE`.
  - Single atomic database transaction guarantees serialized append order.

### 1.4 Unauthorized Modification in Public Judge Mode

- **Threat:** Public judges or unauthenticated reviewers evaluating the applications submit malicious mutations or delete cases.
- **Mitigation:**
  - Server-side authorization middleware (`evaluateSessionContext` and `requireOwnerAuthorization`).
  - In `DEMO_MODE=true`, unauthenticated traffic receives read-only `judge` privileges.
  - All mutating endpoints (POST, PUT, DELETE, PATCH) reject unauthenticated requests with a typed 403 Forbidden response.

### 1.5 Honest Claim Boundaries

- EvidenceKit proves that **captured evidence has not been modified after ingestion**.
- It does not prove that an upstream source system told the truth, nor does it replace legal forensic acquisition.
