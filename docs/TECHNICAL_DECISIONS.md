# EvidenceKit — Technical Decisions Record (ADR) (Phase 0)

**Project:** EvidenceKit  
**Specification:** `03_evidencekit_project_spec_kiroween_2026.md`

---

## ADR 001: Monorepo Architecture with pnpm Workspaces

- **Context:** EvidenceKit powers two distinct applications (`TraceVault` and `AgentLedger`) that share core cryptographic, database, and event-handling engines.
- **Decision:** Use `pnpm` workspaces.
- **Rationale:** Strict package resolution prevents phantom dependencies. Symlinks provide instant local workspace resolution without publishing to npm. Highly compatible with Next.js, TypeScript, and modern bundlers.

---

## ADR 002: Dual Independent Next.js Applications

- **Context:** The Kiroween "Skeleton Crew" category requires demonstrating a single reusable core through two genuinely distinct applications rather than a single toggled dashboard.
- **Decision:** Place `apps/tracevault` and `apps/agentledger` as separate Next.js 14+ App Router projects with independent ports, distinct routing, customized layouts, and specialized domain terminology (Cases vs. Sessions).
- **Rationale:** Proves true decoupling and reusability of `packages/*`.

---

## ADR 003: RFC 8785 JSON Canonicalization Scheme (JCS)

- **Context:** Calculating SHA-256 hashes of JSON event envelopes requires deterministic serialization across different OS platforms, JS engines, and programming languages.
- **Decision:** Adopt strict RFC 8785 JSON Canonicalization Scheme.
- **Rationale:** Ensures key order sorting, IEEE 754 number formatting, and UTF-8 string escaping are cryptographically invariant. Must pass official RFC 8785 test suite.

---

## ADR 004: Event Hash Chain Construction

- **Context:** The hash chain must be tamper-evident, deterministic, and prevent collision or length-extension attacks.
- **Decision:** Apply the exact PRD formula:
  ```text
  canonical_event_i = JCS(event_envelope_i)
  hash_input_i = UTF8("EvidenceKit:event:v1\n") || HEX_DECODE(previous_hash_i) || UTF8("\n") || UTF8(canonical_event_i)
  event_hash_i = SHA256(hash_input_i)
  ```
  The first event uses 32 zero bytes (64 hex `0` characters) as `previous_hash`.
- **Rationale:** Separation of domain prefix (`EvidenceKit:event:v1\n`), binary previous hash, and canonical payload guarantees unambiguous domain separation.

---

## ADR 005: Separation of Chain Append Order and Timeline Occurrence Order

- **Context:** Real-world incident events and agent actions can arrive out of chronological order due to batch imports or network delays.
- **Decision:**
  - Events are appended to the hash chain in strict **ingestion sequence** (`ingest_sequence` / `observed_at`). The hash chain is never re-ordered.
  - The UI timeline query orders by `occurred_at ASC`, tie-broken by `ingest_sequence ASC` and `event_id ASC`.
- **Rationale:** Eliminates hash chain rewrites while giving investigators a chronological timeline.

---

## ADR 006: PostgreSQL + Drizzle ORM

- **Context:** We need atomic transaction control (`SELECT ... FOR UPDATE`), fast JSONB querying, strict unique constraints, and lightweight TypeScript typing.
- **Decision:** Use Drizzle ORM with PostgreSQL.
- **Rationale:** Zero runtime overhead, pure SQL-like schema definitions, type-safe query building, and native support for transactional row locking.

---

## ADR 007: Pre-Persistence Secret Sanitization

- **Context:** Logs, command outputs, and agent actions may inadvertently contain API keys, GitHub tokens, passwords, or bearer headers.
- **Decision:** Execute regex-based pattern redaction on attributes and payloads _before_ JCS canonicalization and hash chain generation.
- **Rationale:** Captured evidence remains shareable with reviewers and judges without exposing credentials. The canonical hash reflects the sanitized evidence.
