# EvidenceKit — Architecture Steering Rules

1. **Package Layers:**
   - Layer 0: `packages/evidence-core` (Zero IO/DB dependencies; pure TypeScript algorithms).
   - Layer 1: `packages/db`, `packages/adapters`, `packages/agent-sdk`, `packages/ui` (Depend only on `evidence-core`).
   - Layer 2: `packages/evidence-server` (Depends on `evidence-core` and `db`).
   - Layer 3: `apps/tracevault` and `apps/agentledger` (Consume shared packages; shared packages never import from apps).
2. **Deterministic Canonicalization:** Only use RFC 8785 JSON Canonicalization Scheme.
3. **Database Concurrency:** Atomic append requires row locking on `chain_heads` table inside a single PostgreSQL transaction.
4. **Ordering Invariance:** Append order is immutable (`ingest_sequence`). Timeline order is computed at query time (`occurred_at`).
