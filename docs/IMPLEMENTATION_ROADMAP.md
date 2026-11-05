# EvidenceKit — Implementation Roadmap (Phase 0, 1, 2)

**Project:** EvidenceKit  
**Specification:** `03_evidencekit_project_spec_kiroween_2026.md`

---

## Phase 0: Complete Repository Audit (CURRENT)

- [x] **Task 0.1:** Inspect directory structure, dependencies, tools, environment.
- [x] **Task 0.2:** Requirements traceability analysis against PRD.
- [x] **Task 0.3:** Architecture gap and risk analysis.
- [x] **Task 0.4:** Audit documentation (`IMPLEMENTATION_AUDIT.md`, `REQUIREMENTS_TRACEABILITY.md`, `ARCHITECTURE_GAP_ANALYSIS.md`, `IMPLEMENTATION_ROADMAP.md`, `TECHNICAL_DECISIONS.md`, `PHASE_0_COMPLETION_REPORT.md`).

---

## Phase 1: Monorepo and Infrastructure Foundation

- [ ] **Task 1.1:** Configure pnpm workspace, root `package.json`, shared `tsconfig.base.json`, formatting (`prettier`), linting (`eslint`), and top-level scripts.
- [ ] **Task 1.2:** Initialize application shells for `apps/tracevault` and `apps/agentledger` (Next.js 14+ App Router, TypeScript, distinct styling/branding).
- [ ] **Task 1.3:** Setup package configurations for:
  - `packages/evidence-core`
  - `packages/evidence-server`
  - `packages/adapters`
  - `packages/agent-sdk`
  - `packages/db`
  - `packages/ui`
    Enforce layer boundaries and package resolution.
- [ ] **Task 1.4:** Database infrastructure with Drizzle ORM and PostgreSQL schema (Workspaces, Users, Cases, Agent Sessions, Evidence Artifacts, Events, Chain Heads, Event Evidence Refs, Agent Approvals, Exports) + migrations.
- [ ] **Task 1.5:** Environment validation using Zod (`.env.example` and runtime configuration parser with fail-safe defaults).
- [ ] **Task 1.6:** Owner authorization & public read-only judge mode.
- [ ] **Task 1.7:** Shared UI design system foundation (dark-neutral high-contrast, responsive investigation primitives).
- [ ] **Task 1.8:** Operational health, readiness, and structured logging infrastructure.
- [ ] **Task 1.9:** CI pipeline configuration with GitHub Actions.
- [ ] **Task 1.10:** Infrastructure automated test suite (package resolution, builds, env validation, judge mode, health check).

---

## Phase 2: EvidenceKit Core Engine

- [ ] **Task 2.1:** Canonical Zod schema for versioned `EvidenceEvent` with strict bounds and validation errors.
- [ ] **Task 2.2:** Reusable normalization pipeline preserving original timestamps and provenance.
- [ ] **Task 2.3:** SHA-256 artifact hashing and multi-type locators (line numbers, JSON pointers, byte ranges).
- [ ] **Task 2.4:** Pre-persistence secret redactor covering API keys, bearer tokens, passwords, and connection strings.
- [ ] **Task 2.5:** RFC 8785 JSON Canonicalization Scheme (JCS) verified against official vectors.
- [ ] **Task 2.6:** Cryptographic SHA-256 hash-chain implementation following exact PRD specification:
      `canonical_event_i = JCS(envelope_i)`
      `hash_input_i = UTF8("EvidenceKit:event:v1\n") || HEX_DECODE(previous_hash_i) || UTF8("\n") || UTF8(canonical_event_i)`
      `event_hash_i = SHA256(hash_input_i)`
- [ ] **Task 2.7:** Transactional atomic event append with chain-head locking and duplicate protection.
- [ ] **Task 2.8:** Independent verification engine detecting payload tampering, deletion, reordering, insertion, and head alteration.
- [ ] **Task 2.9:** Dual-ordering timeline engine supporting pagination, severity/source filtering, and late-arriving events.
- [ ] **Task 2.10:** Portable evidence export bundle (.zip / JSON format) with manifest, verification report, and round-trip re-verification.
- [ ] **Task 2.11:** Shared server services exposing ingestion, retrieval, verification, timeline, and export.
- [ ] **Task 2.12:** Shared UI components (Event Timeline, Detail Drawer, Provenance Panel, Integrity Status Badge, Export Action).
- [ ] **Task 2.13:** Performance benchmarks with a 1,000+ event synthetic dataset.
- [ ] **Task 2.14:** Comprehensive automated testing suite (Vitest + fast-check property-based tests + database integration tests).
