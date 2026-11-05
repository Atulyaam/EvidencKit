# EvidenceKit — Requirements Traceability Matrix (Phase 0)

**Project:** EvidenceKit  
**Specification:** `03_evidencekit_project_spec_kiroween_2026.md`  
**Status Baseline:** Phase 0 Start

---

## 1. Product Goals Traceability

| ID       | Requirement / Goal                      | PRD Section | Baseline Status | Target Phase              | Implementation Scope                    |
| -------- | --------------------------------------- | ----------- | --------------- | ------------------------- | --------------------------------------- |
| **G-01** | Shared Canonical Event Model            | §2.1, §10   | NOT IMPLEMENTED | Phase 2                   | `packages/evidence-core/src/schema`     |
| **G-02** | Evidence Provenance Preservation        | §2.1, §14   | NOT IMPLEMENTED | Phase 2                   | `packages/evidence-core/src/provenance` |
| **G-03** | Tamper-Evident Hash Chain               | §2.1, §10.3 | NOT IMPLEMENTED | Phase 2                   | `packages/evidence-core/src/chain`      |
| **G-04** | Dual-Ordering Timeline Service          | §2.1, §10.1 | NOT IMPLEMENTED | Phase 2                   | `packages/evidence-core/src/timeline`   |
| **G-05** | TraceVault Application                  | §2.1, §12   | NOT IMPLEMENTED | Phase 1 (Shell) / Phase 3 | `apps/tracevault`                       |
| **G-06** | AgentLedger Application                 | §2.1, §13   | NOT IMPLEMENTED | Phase 1 (Shell) / Phase 4 | `apps/agentledger`                      |
| **G-07** | Portable Export & Verification Bundle   | §2.1, §16   | NOT IMPLEMENTED | Phase 2                   | `packages/evidence-core/src/export`     |
| **G-08** | Monorepo Reusable Architecture          | §2.1, §20   | NOT IMPLEMENTED | Phase 1                   | Root workspace, pnpm, TS                |
| **G-09** | Kiro Integration (Specs/Steering/Hooks) | §2.1, §19   | NOT IMPLEMENTED | Phase 1 & 2               | `.kiro/`                                |
| **G-10** | Pre-Persistence Secret Redaction        | §2.1, §18   | NOT IMPLEMENTED | Phase 2                   | `packages/evidence-core/src/redact`     |

---

## 2. Core Functional Requirements Traceability

| Requirement Code | Description                                    | Baseline Status | Implementation Strategy                                                                                                              |
| ---------------- | ---------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **FR-CORE-01**   | RFC 8785 JSON Canonicalization Scheme          | NOT IMPLEMENTED | Conformance test against official RFC 8785 test vectors in `evidence-core`.                                                          |
| **FR-CORE-02**   | SHA-256 Hash Chain with 32-zero initial vector | NOT IMPLEMENTED | Implement prefix `EvidenceKit:event:v1\n` with binary hex-decoded previous hash.                                                     |
| **FR-CORE-03**   | Strict Zod validation of canonical envelope    | NOT IMPLEMENTED | Versioned envelope schema with bounded strings, attributes, and correlation IDs.                                                     |
| **FR-CORE-04**   | Atomic Append with Head Locking                | NOT IMPLEMENTED | PostgreSQL transaction with `chain_heads` row lock and unique `(stream_id, ingest_sequence)` constraint in `evidence-server` & `db`. |
| **FR-CORE-05**   | Independent Chain Verifier                     | NOT IMPLEMENTED | Complete re-computation engine detecting insertions, deletions, mutations, and reorderings.                                          |
| **FR-CORE-06**   | Pre-persistence Secret Redactor                | NOT IMPLEMENTED | High-performance regex pipeline masking tokens, passwords, keys, connection strings.                                                 |
| **FR-CORE-07**   | Portable Export Bundle (.zip / JSON)           | NOT IMPLEMENTED | Export manifest with stream summary, chain head hash, and artifact digest manifest.                                                  |
| **FR-CORE-08**   | Public Read-Only Judge Mode                    | NOT IMPLEMENTED | Server authorization middleware denying mutations unless authenticated owner.                                                        |
| **FR-APP-01**    | TraceVault Incident Reconstructor              | NOT IMPLEMENTED | Independent Next.js app consuming `evidence-server` & `adapters`.                                                                    |
| **FR-APP-02**    | AgentLedger Session Auditor                    | NOT IMPLEMENTED | Independent Next.js app consuming `evidence-server` & `agent-sdk`.                                                                   |

---

## 3. Classification Summary

- **COMPLETE:** 0%
- **PARTIALLY COMPLETE:** 0%
- **NOT IMPLEMENTED:** 100% (Greenfield baseline)
- **BLOCKED:** 0%
