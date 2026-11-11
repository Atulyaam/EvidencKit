# Phase 5.6 Targeted Remediation Plan

**Project:** EvidenceKit (TraceVault & AgentLedger)  
**Author:** Independent Architecture & Security Review Board  
**Target Phase:** Pre-Part 1 Stabilization & Hardening  
**Status:** Approved for Implementation Blueprinting  

---

## 1. Overview & Remediation Strategy

The independent audit uncovered 4 critical/high security vulnerabilities, 12 test database timeout hangs, 1 benchmark flake, 1 Prettier formatting violation, and significant UI component monoliths. This plan outlines concrete, non-breaking remediation steps designed to return the repository to a 100% green, hardened state across all quality gates.

---

## 2. Security Remediation Specifications

### 2.1 SEC-001: Eliminate Authentication Bypass & Hardcoded Backdoors
- **Target File**: `packages/evidence-server/src/authorization/index.ts`
- **Issue**: Lines 33–39 grant `isOwner: true` if `authUser === "owner"` or `"local-dev-owner"` or `cookie: evidencekit_user=owner`.
- **Remediation**:
  1. Remove hardcoded `"owner"` and `"local-dev-owner"` bypass comparisons.
  2. In development/demo mode (`process.env.DEMO_MODE === "true"`), permit mutations only if explicitly designated, or establish a signed HMAC development cookie signed by `AUTH_SECRET`.
  3. Validate `Authorization: Bearer <token>` strictly against `AUTH_SECRET` using constant-time string comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
  4. In tests and Playwright, pass `Authorization: Bearer <AUTH_SECRET>` rather than arbitrary unauthenticated header strings.
- **Regression Test**: Add unit tests in `tests/security-audit.test.ts` verifying that passing `x-evidencekit-user: owner` or `cookie: evidencekit_user=owner` without a valid secret returns 403 Forbidden.

### 2.2 SEC-002: Mitigate Public Key Substitution & Enforce Key Trust
- **Target File**: `packages/evidence-core/src/signatures/index.ts`
- **Issue**: `verifyManifestSignature` blindly verifies the signature using `signatureReceipt.public_key` supplied inside the untrusted manifest.
- **Remediation**:
  1. Add optional `trustedPublicKeys?: string[] | Set<string>` parameter to `verifyManifestSignature`.
  2. If trusted public keys are provided, assert that `signatureReceipt.public_key` matches a trusted key or its fingerprint is within the trusted set.
  3. On server verification routes (`/api/evidence/verify` and `/api/agentledger/verify`), inject the server's configured public key (`getServerEnv().EVIDENCE_VERIFY_PUBLIC_KEY` or current signing key).
  4. Flag self-signed or unrecognized keys with status `"untrusted_signer"` rather than `"verified"`.
- **Regression Test**: Test in `tests/signatures.test.ts` verifying that a manifest signed by an unrecognized key pair is rejected or marked `"untrusted_signer"`.

### 2.3 SEC-003: Prevent Digital Signature Stripping (Downgrade Attack)
- **Target File**: `packages/evidence-core/src/signatures/index.ts`
- **Issue**: If `signatureReceipt` is undefined or null, `verifyManifestSignature` returns `valid: true, status: "unsigned"`.
- **Remediation**:
  1. Distinguish between verifying an explicitly unsigned legacy bundle vs. verifying a stream that is expected to be signed.
  2. Set `valid: false` for unsigned bundles unless caller explicitly passes `allowUnsigned: true`.
  3. Update verification UI to display a clear warning banner: "Unsigned Bundle: Cryptographic non-repudiation cannot be guaranteed."
- **Regression Test**: Verify in `tests/signatures.test.ts` that stripping `signature` from a signed bundle returns `valid: false` under strict mode.

### 2.4 SEC-004: Enforce Tenant Isolation on Workspace Queries (IDOR Fix)
- **Target Files**:
  - `packages/evidence-server/src/services/incident-service.ts:183`
  - `apps/tracevault/app/api/evidence/graph/route.ts:9`
  - `apps/agentledger/app/api/agentledger/graph/route.ts:9`
- **Issue**: `query.workspaceId || workspaceId` allows arbitrary callers to pass `?workspaceId=another_tenant` and read other workspaces.
- **Remediation**:
  1. Resolve authenticated `workspaceId` strictly from session context or authenticated owner profile.
  2. Only permit `query.workspaceId` override if `context.role === "admin"` or `context.isOwner === true` AND multi-workspace permission is granted.
  3. Reject unauthorized workspace queries with HTTP 403 Forbidden.
- **Regression Test**: Add test in `tests/evidence-graph.test.ts` asserting that an unauthenticated caller cannot query an isolated workspace.

### 2.5 SEC-005: Persistent Server Signing Key Configuration
- **Target File**: `packages/evidence-server/src/services/export-bundle-service.ts`
- **Issue**: `ExportBundleService` instantiates a random key pair on every cold restart.
- **Remediation**:
  1. Inspect `process.env.EVIDENCE_SIGNING_PRIVATE_KEY`. If present, import the PKCS8 private key and derive the SPKI public key and fingerprint.
  2. If missing, generate an ephemeral key pair only in development/test, and log a clear warning: `[SECURITY NOTICE] Running with ephemeral signing key. Set EVIDENCE_SIGNING_PRIVATE_KEY for production continuity.`
- **Regression Test**: Verify that providing a static private key in environment variables produces deterministic signatures across multiple service instantiations.

### 2.6 SEC-006: Genuine In-Browser Offline Verification
- **Target Files**:
  - `apps/tracevault/app/verify/page.tsx`
  - `apps/agentledger/app/verify/page.tsx`
- **Issue**: Both pages issue network `fetch()` requests to the backend server.
- **Remediation**:
  1. Import `@evidencekit/core` cryptographic verification routines (`verifyChainIntegrity`, `verifyManifestSignature`, `canonicalizeJson`) directly into client components.
  2. Use Web Cryptography API (`crypto.subtle.digest("SHA-256")`) or client-side crypto fallback so verification executes 100% locally in the browser memory without network requests.
  3. Provide an explicit offline indicator: "Verified locally in browser sandbox — zero server network requests."
- **Regression Test**: E2E test verifying that verification functions successfully even when the backend API routes are disabled.

---

## 3. Quality & Test Reliability Remediations

### 3.1 Prettier Formatting Alignment
- **Target Files**:
  - `fixtures/agentledger/exported-signed-bundle.json`
  - `fixtures/tracevault/exported-valid-bundle.json`
- **Action**: Run `pnpm format` to align JSON indentation to `.prettierrc` rules, restoring `pnpm format:check` to exit code 0.

### 3.2 Benchmark Timing Assertion Stability
- **Target File**: `tests/agent-scale.test.ts:93`
- **Action**: Adjust the timing assertion from `< 100ms` to `< 350ms` or test relative throughput (> 1,000 ops/sec) rather than a rigid 100ms threshold that flakes under normal system CPU scheduling.

### 3.3 Database Pre-Flight Health Check & Graceful Timeout
- **Target Files**:
  - `packages/db/src/client.ts`
  - `packages/evidence-server/src/services/incident-service.ts`
  - `packages/evidence-server/src/services/agent-session-service.ts`
  - `packages/evidence-server/src/services/evidence-graph-service.ts`
- **Remediation**:
  1. In `packages/db/src/client.ts`, reduce initial `connectionTimeoutMillis` to `1500ms` for test environments.
  2. Implement an asynchronous `isDatabaseAvailable(): Promise<boolean>` probe that caches connectivity state for 10 seconds.
  3. When PostgreSQL is unreachable, immediately route all operations to in-memory fallback without waiting for 5000ms query timeouts.
  4. In test suites (`agent-approval.test.ts`, `agent-session.test.ts`, `agentledger-e2e.test.ts`), wrap DB-dependent tests with connectivity checks so they cleanly use in-memory state or skip if live DB is absent.

---

## 4. Performance & Architectural Remediations

### 4.1 Eliminate Evidence Graph N+1 Query Cascade
- **Target File**: `packages/evidence-server/src/services/evidence-graph-service.ts`
- **Remediation**:
  1. Replace iterative `for (const sid of activeStreamIds) { db.select().from(events)... }` with a single batch `inArray(events.streamId, activeStreamIds)` query.
  2. Batch query `agentApprovals` for all session IDs in one round-trip: `inArray(agentApprovals.sessionId, sessionIds)`.
  3. Reduces database round trips per graph query from up to 151 down to 3.

### 4.2 Deduplicate Graph Route & UI Code
- **Target Files**:
  - `apps/tracevault/app/graph/page.tsx`
  - `apps/agentledger/app/graph/page.tsx`
  - `apps/tracevault/app/api/evidence/graph/route.ts`
  - `apps/agentledger/app/api/agentledger/graph/route.ts`
- **Remediation**:
  1. Extract shared graph visualization component into `packages/ui/src/components/evidence-graph-viewer.tsx`.
  2. Standardize API route to `/api/graph` across both apps.

---

## 5. Implementation Verification Matrix

| Step | Task | Target Files | Verification Command | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **R-1** | Fix Prettier formatting | `fixtures/**/*.json` | `pnpm format:check` | Exit code 0 |
| **R-2** | Fix agent-scale benchmark threshold | `tests/agent-scale.test.ts` | `pnpm vitest run tests/agent-scale.test.ts` | Passes consistently |
| **R-3** | DB connectivity probe & fast failover | `packages/db`, `packages/evidence-server` | `pnpm test` | 129 tests passing (100%) |
| **R-4** | Hardcode auth bypass remediation (SEC-001) | `packages/evidence-server/src/authorization` | `pnpm vitest run tests/security-audit.test.ts` | Unauthorized header rejected |
| **R-5** | Public key trust & stripping (SEC-002, 003) | `packages/evidence-core/src/signatures` | `pnpm vitest run tests/signatures.test.ts` | Untrusted signers flagged |
| **R-6** | Genuine browser offline verification (SEC-006)| `apps/*/app/verify/page.tsx` | Playwright offline test | No network calls to `/api/.../verify` |
| **R-7** | Graph N+1 query batching | `packages/evidence-server/src/services/evidence-graph-service.ts` | `pnpm vitest run tests/evidence-graph.test.ts` | <= 3 DB queries |
| **R-8** | Full quality gate rerun | All | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` | All exit code 0 |

