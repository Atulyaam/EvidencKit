# EvidenceKit Phase 4.5 Architecture Plan: Product Differentiation, Advanced Governance & Unified Graph

**Date:** 2026-11-06  
**Status:** Approved for Implementation  
**Feature Branch:** `feature/phase-4.5-governance-and-differentiation`  
**Base Commits:** Phase 4 `342bf85`, Phase 5 `2d8a957`  
**Monorepo:** EvidenceKit (`apps/tracevault`, `apps/agentledger`, `packages/*`)  

---

## 1. Pre-Implementation Audit & Baseline State

### 1.1 Quality Baseline
- **Prettier:** 100% compliant (`pnpm format:check` PASS).
- **ESLint:** 0 errors / 0 warnings (`pnpm lint` PASS).
- **TypeScript:** Strict compilation (`pnpm typecheck` PASS).
- **Vitest Suites:** 103 passed / 103 tests in 26 test files.
- **Playwright E2E:** 11 passed / 11 tests across 3 spec files (`tracevault.spec.ts`, `agentledger.spec.ts`, `responsive.spec.ts`).
- **Production Build:** Turbo production build succeeded across all packages and Next.js applications.

### 1.2 Resolution of `shell_command` Discrepancy & Authoritative Policy
- **Investigation:** In `packages/evidence-server/src/services/agent-sandbox-service.ts`, `ALLOWED_TOOLS` is explicitly locked to:
  `["list_files", "read_file", "create_file", "modify_file", "calculate_file_hash"]`.
- **Finding:** Earlier high-level narrative audits cited `shell_command` alongside file modifications as examples of sensitive operations in security literature. However, the runtime deliberately disallows arbitrary shell execution to prevent Remote Code Execution (RCE) and system escape vulnerabilities.
- **Authoritative Policy Decision:**  
  *Arbitrary shell command execution is categorically forbidden.* We will **not** enable arbitrary shell execution merely to showcase approval modals. In the new deterministic Policy Engine, attempts to execute non-allowlisted tools (such as `shell_command`) evaluate strictly to `DENY` with an explicit reason (`UNAUTHORIZED_TOOL_CLASS: Arbitrary shell execution is prohibited by security policy`) or are rejected prior to execution by the sandbox allowlist.

---

## 2. Subsystem Architectural Blueprints

### Part B — AgentLedger Policy Intelligence Engine
A deterministic, versioned policy engine to govern autonomous agent behavior before tool execution.

1. **Policy Schema (`@evidencekit/core/src/policy`):**
   - Decisions: `ALLOW`, `REQUIRE_APPROVAL`, `DENY`.
   - Rule criteria:
     - `tool`: Specific tool name or wildcard `*`.
     - `operation`: e.g. `read`, `write`, `delete`, `execute`.
     - `pathPattern`: Glob or substring patterns (e.g., `src/protected-config.ts`, `*.env`, `**/secrets/**`).
     - `riskLevel`: `low` | `medium` | `high` | `critical`.
     - `action`: `ALLOW` | `REQUIRE_APPROVAL` | `DENY`.
     - `reason`: Human-readable explanation.
   - Versioning: `version: string` (e.g. `1.0.0`), `rules: PolicyRule[]`, `createdAt: string`.
2. **Evaluation Pipeline (`@evidencekit/server/src/services/agent-policy-service.ts`):**
   - Server-side evaluation prior to `executeTool`.
   - Order of precedence: `DENY` > `REQUIRE_APPROVAL` > `ALLOW` (or first-match priority rules with default fallback).
   - Returns explainable result:
     ```ts
     interface PolicyEvaluationResult {
       decision: "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
       matchedRuleId: string;
       policyVersion: string;
       reason: string;
       requestedAction: { tool: string; operation?: string; path?: string };
       approvalRequired: boolean;
     }
     ```
3. **Audit Log Integration:**
   - Emits canonical EvidenceKit events into the session hash chain:
     - `agent.policy.evaluated`
     - `agent.approval.requested`
     - `agent.approval.decided`
4. **Policy Simulator & UI:**
   - Interactive UI in AgentLedger (`/policies` or tab `/sessions/[id]/policies`):
     - View active policies and version history.
     - Policy Simulator: evaluate hypothetical tool calls against policies with zero filesystem mutation.
     - Real-time decision explanations and matched rule badges.

---

### Part C — Unified Evidence Graph
A cross-application relationship graph connecting entities from both TraceVault and AgentLedger.

1. **Entity Graph Schema (`@evidencekit/core/src/graph`):**
   - **Nodes:**
     - `incident` (TraceVault incident)
     - `event` (EvidenceKit hash-chained event)
     - `session` (AgentLedger audit session)
     - `tool_call` (Agent tool execution)
     - `approval` (Human gate request/decision)
     - `artifact` (Source logs, git commits, uploaded files)
     - `report` (Investigation or export artifact)
   - **Edges:**
     - `explicit` (e.g. `event_in_stream`, `caused_by_tool`, `governed_by_approval`, `references_artifact`)
     - `inferred_candidate` (temporal proximity, shared error cluster — **clearly marked non-causal**)
2. **Query & Pagination Engine (`@evidencekit/server/src/services/evidence-graph-service.ts`):**
   - Supports filtering by `streamId`, `workspaceId`, `nodeTypes`, `timeRange`, and `relationshipType`.
   - Progressive loading / pagination limit (default 100 nodes per query) to prevent browser DOM exhaustion on 10,000-event streams.
   - Workspace isolation enforced on every query.
3. **Interactive UI (`packages/ui/src/components/evidence-graph.tsx` or app pages):**
   - Visual nodes with type-specific icons, connection badges, explicit vs. candidate edge styling (solid vs. dashed), and an inspector panel showing raw event payload and SHA-256 hashes.

---

### Part D — Evidence Quality & Coverage Engine
A deterministic forensic validation service assessing evidence completeness and integrity without claiming truthfulness.

1. **Quality Rules (`@evidencekit/core/src/quality`):**
   - `MISSING_SOURCE_METADATA`: Incomplete `source.system` or `source.adapter`.
   - `DUPLICATE_EVENT`: Same content hash or identical payload in stream.
   - `TIMESTAMP_ANOMALY`: `observed_at < occurred_at` (future logging) or clock skew > 24 hours.
   - `MISSING_PROVENANCE`: Missing `previous_hash` or broken chain sequence.
   - `INGESTION_ANOMALY`: Unrecognized or malformed envelope structures.
   - `SENSITIVE_REDACTION_COUNT`: Audit tally of redacted tokens.
   - `SOURCE_COVERAGE`: Percentage breakdown of evidence across system sources.
2. **Quality Report Contract:**
   - Summary: total events, completeness score (deterministic 0-100% based strictly on missing metadata fields), issue count by severity (`critical`, `warning`, `info`).
   - Detailed findings with event IDs, rule explanation, and concrete remediation advice.
   - **Disclaimers:** Strictly clarifies that quality scores reflect structural completeness and cryptographic consistency, not external truthfulness.
3. **TraceVault & AgentLedger Integration:**
   - Dedicated Quality Tab / View displaying issues, source coverage donuts/bars, and exportable quality summaries.

---

### Part E — Signed Evidence Receipts (Ed25519)
Cryptographic digital signatures on exported evidence bundles for third-party non-repudiation.

1. **Ed25519 Cryptographic Layer (`@evidencekit/core/src/signatures`):**
   - Uses Node.js native `crypto.sign` / `crypto.verify` (Ed25519).
   - Generates and signs canonical JSON export manifests using RFC 8785.
   - Manifest contents:
     - `export_version`: `"2.0"`
     - `export_id`: UUID
     - `stream_id`: string
     - `head_hash`: SHA-256
     - `event_count`: number
     - `workspace_id`: string
     - `created_at`: ISO 8601
     - `public_key_fingerprint`: SHA-256 of public key
     - `key_id`: e.g. `"ek-signer-prod-2026"`
2. **Bundle Structure (`ExportBundle`):**
   ```json
   {
     "manifest": { ... },
     "signature": {
       "algorithm": "Ed25519",
       "key_id": "ek-signer-prod-2026",
       "public_key": "base64...",
       "value": "base64..."
     },
     "events": [ ... ],
     "verification_report": { ... }
   }
   ```
3. **Verifier Extension (`/verify`):**
   - Verifies:
     1. Bundle JSON structure.
     2. SHA-256 hash-chain linkage from genesis to head.
     3. RFC 8785 canonical manifest integrity.
     4. Ed25519 digital signature against public key.
     5. Public key fingerprint match.
   - Backward compatibility: Unsigned bundles (`export_version: 1.0` or missing signature) remain valid and verify hash-chain integrity with a notice indicating legacy unsigned bundle.

---

### Part F — User Experience Polish & Cross-Navigation
1. **TraceVault Enhancements:**
   - Header & navigation links to Evidence Graph and Evidence Quality reports.
   - Clear distinction between raw evidence events and candidate correlation links.
2. **AgentLedger Enhancements:**
   - Policy Management & Simulation tab.
   - Explainable decision chips on timeline and approvals cards.
   - Replay step inspection showing policy evaluation context.
3. **Shared Navigation:**
   - Top banner switchers allowing seamless pivoting between TraceVault (Incident view) and AgentLedger (Agent audit view) on corresponding streams.

---

### Part G — Database & Security Invariants
- Extend existing Drizzle schema only where necessary (e.g. `policies` table or persist policies within existing session/workspace records).
- All authorization and policy decisions enforced strictly on the server.
- Private signing keys loaded from environment variables (`EVIDENCEKIT_SIGNING_KEY_ED25519`); never sent to client.

---

## 3. Implementation Phasing Strategy

```
Phase 4.5 Implementation Order:
1. Part B: Policy Intelligence Engine (Core schemas + Server service + AgentLedger UI + Tests)
2. Part C: Unified Evidence Graph (Core models + Server service + Visual UI + Tests)
3. Part D: Evidence Quality & Coverage (Core quality analyzer + Server service + Quality UI + Tests)
4. Part E: Ed25519 Signed Evidence Receipts (Cryptographic signer/verifier + Bundle export/import + `/verify` updates + Tests)
5. Part F: Cross-Application Navigation & Judge Demo Scenario
6. Part H & I: Full Automated Test Suites & Performance Benchmarks
7. Part J: Phase 5.5 Independent Re-Audit & Deliverables
```
