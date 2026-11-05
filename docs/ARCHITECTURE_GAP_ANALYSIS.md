# EvidenceKit — Architecture Gap Analysis (Phase 0)

**Project:** EvidenceKit  
**Specification:** `03_evidencekit_project_spec_kiroween_2026.md`

---

## 1. Architectural Gap Assessment

Since the repository is currently in its initial state, this analysis focuses on critical boundary risks, potential design hazards, and strict mitigation strategies before implementing Phase 1 and Phase 2.

### Gap 1: Cryptographic Invariance vs. Object Serialization

- **Risk:** Standard JavaScript `JSON.stringify()` has undefined key order and platform-specific floating-point/whitespace formatting, which would break cross-platform hash chain verification.
- **Mitigation:** Use RFC 8785 JSON Canonicalization Scheme (JCS) via an exact compliant canonicalizer. Verify with official RFC test vectors.
- **Strict Rule:** Chain hashes must be computed exclusively from canonical bytes, never from pretty-printed JSON or raw database JSONB strings.

### Gap 2: Chain Append Concurrency & Stream Head Race Conditions

- **Risk:** High-throughput event ingestion could produce duplicate sequence numbers or split-brain chains if two events for the same stream are appended simultaneously.
- **Mitigation:**
  1. Relational schema constraint: `UNIQUE (stream_id, ingest_sequence)`.
  2. Transactional lock on the stream's record in `chain_heads` (`SELECT ... FOR UPDATE`).
  3. Single database transaction enclosing: read head -> calculate hash -> insert event -> update head -> commit.

### Gap 3: Dual-Time Semantics (Occurred vs. Observed)

- **Risk:** Clock skew, delayed log delivery, and late-arriving events could cause events to arrive out of chronological order. If events were inserted into the hash chain based on `occurred_at`, the hash chain would mutate retroactively, destroying verification.
- **Mitigation:**
  1. The **Hash Chain** strictly orders by ingestion sequence (`ingest_sequence` and `observed_at`). The chain is immutable once written.
  2. The **Timeline Engine** sorts by `occurred_at` (tie-breaking by `ingest_sequence` and `event_id`) at query time. Late events append to the end of the chain, but appear in their historical slot in the timeline view.

### Gap 4: Leakage of Credentials and Sensitive Artifacts

- **Risk:** Application logs, CI variables, and agent tool execution outputs often contain authorization tokens, database passwords, or private keys. Persisting them makes evidence stores dangerous.
- **Mitigation:**
  1. Mandatory pre-persistence redaction pipeline in `evidence-core`.
  2. Typed placeholder markers: `[REDACTED_API_KEY]`, `[REDACTED_AUTH_TOKEN]`, `[REDACTED_SECRET]`.
  3. Redaction happens before computing canonical bytes, so the verified hash reflects the sanitized envelope.

### Gap 5: Monorepo Circular Dependencies & Package Creep

- **Risk:** Packages importing from each other circular-style or applications importing internal database helpers directly.
- **Mitigation:** Strict package boundary hierarchy:
  - Layer 0: `evidence-core` (Zero dependencies, pure TypeScript logic)
  - Layer 1: `db`, `adapters`, `agent-sdk`, `ui` (Depend only on `evidence-core`)
  - Layer 2: `evidence-server` (Depends on `db` and `evidence-core`)
  - Layer 3: `apps/tracevault` and `apps/agentledger` (Depend on shared packages; never imported by packages)

---

## 2. Decision Record for Infrastructure Simplicity

To keep the system performant for a solo developer:

- **No microservices:** All server operations execute within Next.js API route handlers / server actions or modular shared services.
- **No Kafka / RabbitMQ:** PostgreSQL row locking provides robust atomic sequencing without external broker overhead.
- **No Python dependencies:** All adapters, normalizers, hash chain algorithms, and UI run natively in modern TypeScript/Node.js.
