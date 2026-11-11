# Phase 5.6 Master Independent Audit & System Verification Report

**Project:** EvidenceKit  
**Applications:** TraceVault (Incident Reconstruction) & AgentLedger (AI Agent Activity Auditing)  
**Hackathon Target:** Kiroween 2026 — Category: Skeleton Crew  
**Audit Date:** 2026-11-11  
**Audit Team:** Combined Architecture, Security, Performance, UI/UX, QA, and Reliability Review Board  
**Target Branch:** `feature/phase-4.5-governance-and-differentiation`  
**Target Commit:** `2366644` (Verified HEAD)  

---

## 1. Executive Summary

An independent, critical audit was conducted on EvidenceKit at commit `2366644`. All historical claims made in prior phase reports (`PHASE_5_5_RELEASE_READINESS.md`, `PHASE_5_INDEPENDENT_AUDIT_REPORT.md`, `PHASE_4_5_IMPLEMENTATION_REPORT.md`) were subjected to empirical verification.

### Key Audit Verdict: **CONDITIONAL PASS / ACTION REQUIRED**

While the core conceptual architecture (monorepo design, RFC 8785 canonical JSON serialization, SHA-256 hash chaining, policy evaluation logic, and Ed25519 signing primitives) is implemented with high technical ambition, **critical discrepancies exist between previously reported status and actual repository reality**:

1. **Test Suite Reality**: Previously claimed "129 tests passing (100% pass rate)". Empirical test run revealed **116 passed, 13 failed across 6 test files** (`pnpm test` exit code 1).
   - 1 test failure was caused by a fragile CPU-timing assertion threshold (`tests/agent-scale.test.ts:93`, 140.2ms vs <100ms threshold).
   - 12 test failures were caused by unhandled database connection timeouts (5000ms per test) to an unreachable WSL2 host (`172.31.88.58:5432`).
2. **End-to-End Reality**: Previously claimed "12 Playwright tests passing". Empirical test run revealed **5 passed, 7 failed** (`pnpm test:e2e` exit code 1) due to database 500 errors and navigation timeouts.
3. **Code Formatting Reality**: Previously claimed "All quality gates pass". Prettier check (`pnpm format:check`) **failed with exit code 1** on 2 JSON fixture files.
4. **Security Vulnerabilities**:
   - **Critical (SEC-001)**: Hardcoded authentication bypass in `evaluateSessionContext` allows any HTTP client to gain `isOwner: true` privileges simply by passing header `x-evidencekit-user: owner` or cookie `evidencekit_user=owner`.
   - **High (SEC-002)**: Ed25519 signature verification (`verifyManifestSignature`) trusts self-contained public keys in untrusted bundles without server key pinning or trust root validation, allowing self-signed manifest tampering.
   - **High (SEC-003)**: Signature stripping allows a tampered bundle with removed signature receipt to be evaluated as `valid: true`.
   - **High (SEC-004)**: Workspace isolation is vulnerable to IDOR via query parameter overrides (`?workspaceId=...`) in incident and graph queries.
5. **False Offline Claims**:
   - The `/verify` routes in both TraceVault and AgentLedger claim "independent offline verification without relying on server trust", but actually issue `fetch("/api/evidence/verify")` HTTP POST requests to the backend server. No in-browser cryptographic verification exists.
6. **UI/UX Monoliths & AI Aesthetic**:
   - Neither application has a `components/` directory; every route is implemented as a monolithic 200–400 line `page.tsx` client component.
   - TraceVault relies heavily on raw emojis (`📁`, `📥`, `📄`, `🛡️`, `🔍`, `🔐`), whereas AgentLedger uses `lucide-react`.
   - The "Evidence Graph Explorer" is not a canvas or node-link graph; it is a 2-column CSS card list with edge text in a side panel.

---

## 2. Historical Claims vs. Empirical Reality Matrix

| Area | Previously Reported Claim | Empirical Reality (Audited) | Variance Status |
| :--- | :--- | :--- | :--- |
| **Commit Baseline** | Branch `feature/phase-4.5-governance-and-differentiation`, commit `2366644` | Verified. `2366644` is HEAD of branch. Working tree clean. | **VERIFIED** |
| **Prettier Formatting** | Passed | **FAILED** (exit code 1). 2 files failed: `fixtures/agentledger/exported-signed-bundle.json`, `fixtures/tracevault/exported-valid-bundle.json`. | **DISPROVED** |
| **ESLint** | Passed | **PASSED** (exit code 0). Zero lint warnings or errors. | **VERIFIED** |
| **TypeScript Typecheck** | Passed (`tsc --noEmit`) | **PASSED** (exit code 0). Zero compile errors across all 6 packages and 2 apps. | **VERIFIED** |
| **Unit & Integration Tests** | 129 tests passing across 31 files (100%) | **FAILED** (exit code 1). 116 passed, 13 failed. (1 threshold flake, 12 DB timeout hangs). | **DISPROVED** |
| **Playwright E2E Tests** | 12 tests passing across 4 specs (100%) | **FAILED** (exit code 1). 5 passed, 7 failed (database 500 errors and timeouts). | **DISPROVED** |
| **Production Build** | Both apps build successfully | **PASSED** (exit code 0). `@evidencekit/*` packages and Next.js builds for both apps succeed. | **VERIFIED** |
| **Database Persistence** | Real PostgreSQL persistence verified | **FAILED LOCALLY**. Configured `172.31.88.58:5432` is unreachable. Fallback logic crashes on timeouts. | **CONDITIONAL** |
| **Offline Verifier** | Independent offline verification in browser | **FALSE**. Verifier pages execute `fetch()` to `/api/.../verify`. Offline mode fails. | **DISPROVED** |
| **Public Key Management** | Server-side key management with Ed25519 | **EPHEMERAL**. Server creates a random key pair on every cold restart; ignores `.env` keys. | **DISPROVED** |
| **Policy Engine** | Server-side deterministic policy enforcement | **PARTIAL**. Implemented in memory, but `tool-call/route.ts` ignores workspace ID parameter. | **PARTIAL** |
| **Unified Evidence Graph** | Interactive multi-stream evidence graph explorer | **DECEPTIVE**. No graph visualization library used; rendered as standard CSS card grid. | **PARTIAL** |

---

## 3. Monorepo Quality Gate Status Summary

Commands executed under Windows PowerShell on Node v20.18.0 / pnpm 9.12.3:

```text
pnpm format:check  -> Exit Code 1 (2 files unformatted)
pnpm lint          -> Exit Code 0 (Clean)
pnpm typecheck     -> Exit Code 0 (Clean)
pnpm test          -> Exit Code 1 (116 passed, 13 failed, 31 test suites)
pnpm test:e2e      -> Exit Code 1 (5 passed, 7 failed, 12 browser tests)
pnpm build         -> Exit Code 0 (TraceVault & AgentLedger successfully compiled)
```

---

## 4. Root Cause of Test Failures

### 4.1 Vitest Test Suite Failures (13 Tests)
1. **Timing Threshold Flake (1 failure)**:
   - `tests/agent-scale.test.ts:93`: `expect(reconstructionTimeMs).toBeLessThan(100)`
   - Measured time: `140.22ms`. The test asserts an absolute wall-clock CPU execution time under 100ms for 250 replay events, which fails under normal operating system scheduling jitter.
2. **Database Connection Hangs (12 failures)**:
   - Tests `agent-approval.test.ts` (4 tests), `agent-session.test.ts` (4 tests), `agentledger-e2e.test.ts` (2 tests), `evidence-graph.test.ts` (1 test), and `postgres-persistence.test.ts` (1 test) pass `getDb()` into services.
   - `getDbPool()` in `packages/db/src/client.ts` sets `connectionTimeoutMillis: 5000`.
   - `DATABASE_URL` is configured to `172.31.88.58:5432`.
   - When the host is unreachable, the connection hangs for 5000ms until Vitest's default per-test timeout (5000ms) terminates the test before `pg` can emit a connection error.

### 4.2 Playwright Browser Test Failures (7 Tests)
1. Tests creating sessions or running demos trigger Next.js API routes (`POST /api/agentledger/sessions`, `POST /api/agentledger/sessions/.../demo/run`).
2. Inside API route handlers, `db.insert(...)` hangs on unreachable PostgreSQL, throws unhandled rejection after 5000ms, and returns HTTP 500.
3. Playwright encounters HTTP 500 errors on API endpoints and times out waiting for redirect URLs.

---

## 5. Architectural Health Assessment

The architectural separation between `@evidencekit/core` (zero-dependency pure math/crypto), `@evidencekit/adapters` (log/CI/git normalizers), `@evidencekit/db` (Drizzle ORM schema), and `@evidencekit/evidence-server` (business logic) is conceptually sound. However, the operational implementation suffers from:

- **Lack of Graceful Database Degradation**: Services attempt database queries without verifying health first, causing catastrophic 5-second request hangs.
- **Client Component Overload**: Nearly every page is `"use client"` fetching data in `useEffect`, producing loading cascades and unrendered initial HTML.
- **Copy-Paste Duplication**: `apps/tracevault/app/graph/page.tsx` and `apps/agentledger/app/graph/page.tsx` are 95% identical duplicate code.
- **Missing Domain Entities**: The `AgentPolicy` entity has no database table in `@evidencekit/db`. Policies are stored in process memory Maps and lost on restarts.

---

## 6. Audit Verdict and Next Actions

The codebase has strong bones and genuine cryptographic innovation (RFC 8785 canonicalization, hash chaining, and Ed25519 signing), but requires urgent stabilization before proceeding with feature development:

- **Security Gate**: Remediate SEC-001 (auth bypass), SEC-002 (public key substitution), SEC-003 (signature stripping), and SEC-004 (workspace IDOR).
- **Test Reliability Gate**: Add automated database connectivity pre-flight checks and fast-fail fallback to prevent test suite timeouts.
- **UI/UX Modernization**: Replace card-grid pseudo-graph with an authentic visualization, eliminate emojis, and extract shared presentation components.

See `docs/PHASE_5_6_REMEDIATION_PLAN.md` and `docs/MASTER_IMPLEMENTATION_ROADMAP.md` for prioritized execution steps.

