# EvidenceKit Independent Security Audit Findings

**Project:** EvidenceKit (TraceVault & AgentLedger)  
**Lead Auditor:** Senior Application Security Engineer & Cryptographic Reviewer  
**Audit Date:** 2026-11-11  
**Classification:** STRICTLY EVIDENCE-BACKED CODE AUDIT  
**Commit Inspected:** `2366644` (Branch: `feature/phase-4.5-governance-and-differentiation`)  

---

## 1. Executive Security Summary

An exhaustive, code-level vulnerability assessment was performed across all packages and applications. The review validated core cryptographic strengths (e.g. strict canonicalization via RFC 8785, SHA-256 hash chaining, path traversal prevention in `agent-sandbox-service.ts`), but identified **4 Critical/High vulnerabilities** and **5 Medium/Low weaknesses** requiring immediate remediation.

### Vulnerability Severity Distribution
- **Critical**: 1
- **High**: 3
- **Medium**: 3
- **Low**: 1
- **Informational**: 1

---

## 2. Detailed Findings Register

### SEC-001: Hardcoded Authentication Bypass via Unauthenticated Header / Cookie Spoofing
- **Finding ID**: SEC-001
- **Severity**: **Critical**
- **Affected Component**: `@evidencekit/evidence-server` (Authorization Subsystem)
- **Exact Source Location**: `packages/evidence-server/src/authorization/index.ts:32–39`
- **Evidence**:
  ```typescript
  const authUser = getHeader("x-evidencekit-user") || getHeader("authorization") || cookieUser;
  const isOwner = Boolean(
    authUser &&
    (authUser === env.OWNER_GITHUB_ID ||
      authUser === "local-dev-owner" ||
      authUser === "owner" ||
      authUser.replace(/^Bearer\s+/i, "") === env.AUTH_SECRET)
  );
  ```
- **Reproduction / Validation Method**:
  Issue a curl command to any protected mutation route without credentials:
  ```bash
  curl -X POST http://localhost:3001/api/incidents \
    -H "Content-Type: application/json" \
    -H "x-evidencekit-user: owner" \
    -d '{"title":"Malicious Incident Injected","workspaceId":"default"}'
  ```
  The server responds with HTTP 201 Created and full owner execution privileges.
- **Actual Impact**: Any unauthenticated client or adversary on the internet can spoof `x-evidencekit-user: owner` or set cookie `evidencekit_user=owner` to gain complete administrative read, write, update, and delete access over all incidents, agent sessions, sandbox files, and approval decisions.
- **Recommended Remediation**:
  1. Remove hardcoded strings `"owner"` and `"local-dev-owner"` completely.
  2. Implement HMAC-SHA256 signed session cookies or validate Bearer tokens using constant-time equality against `AUTH_SECRET`.
  3. Ensure headers like `x-evidencekit-user` cannot be injected by external clients through reverse proxies (e.g., strip untrusted headers at gateway).
- **Required Regression Test**: In `tests/security-audit.test.ts`, test that sending `x-evidencekit-user: owner` or `cookie: evidencekit_user=owner` results in `context.isOwner === false` and throws 403 on mutation endpoints.
- **Verification Status**: **CONFIRMED VULNERABILITY**.

---

### SEC-002: Digital Signature Public-Key Substitution (Self-Signed Manifest Forgery)
- **Finding ID**: SEC-002
- **Severity**: **High**
- **Affected Component**: `@evidencekit/core` (Signatures Subsystem)
- **Exact Source Location**: `packages/evidence-core/src/signatures/index.ts:122–147`
- **Evidence**:
  ```typescript
  // 2. Validate public key fingerprint
  const computedFingerprint = computePublicKeyFingerprint(signatureReceipt.public_key);
  if (computedFingerprint.toLowerCase() !== signatureReceipt.public_key_fingerprint.toLowerCase()) {
    return { valid: false, status: "invalid", error: "Public key fingerprint mismatch" };
  }

  // 3. Reconstruct canonical manifest bytes & verify with untrusted public key
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(signatureReceipt.public_key, "base64"),
    format: "der",
    type: "spki"
  });
  const isVerified = crypto.verify(null, dataToVerify, publicKey, signatureBuffer);
  ```
- **Reproduction / Validation Method**:
  1. Export a valid signed evidence bundle.
  2. Modify `events.jsonl` or `manifest.json`.
  3. Generate an attacker Ed25519 key pair with `crypto.generateKeyPairSync("ed25519")`.
  4. Sign the modified manifest with the attacker's private key.
  5. Replace `signature.public_key`, `signature.public_key_fingerprint`, and `signature.signature_value` with the attacker's credentials.
  6. Submit to `/api/evidence/verify`. The verifier returns:
     `{ valid: true, status: "verified", algorithm: "Ed25519" }`.
- **Actual Impact**: Complete loss of cryptographic non-repudiation. An attacker who modifies an evidence bundle can forge a valid digital signature using their own key pair, and the verifier will certify it as genuine because it fails to check against trusted keys.
- **Recommended Remediation**:
  1. Add an optional `trustedPublicKeys` whitelist to `verifyManifestSignature`.
  2. Server verification routes must check the key against the known server public key (`process.env.EVIDENCE_VERIFY_PUBLIC_KEY`).
  3. If a bundle is signed with an unknown public key, label the result `"untrusted_signer"` and mark `valid: false` (or require explicit user acceptance).
- **Required Regression Test**: In `tests/signatures.test.ts`, assert that verifying a manifest with an untrusted or newly-generated key pair returns `status: "untrusted_signer"`.
- **Verification Status**: **CONFIRMED VULNERABILITY**.

---

### SEC-003: Signature Stripping Downgrade Bypass
- **Finding ID**: SEC-003
- **Severity**: **High**
- **Affected Component**: `@evidencekit/core` (Signatures Subsystem)
- **Exact Source Location**: `packages/evidence-core/src/signatures/index.ts:102–109`
- **Evidence**:
  ```typescript
  if (!signatureReceipt) {
    return {
      valid: true, // Legacy unsigned bundles remain structurally valid
      status: "unsigned",
      disclaimer: SIGNATURE_DISCLAIMER,
      error: "No digital signature provided (Legacy Unsigned Bundle v1.0)"
    };
  }
  ```
- **Reproduction / Validation Method**:
  1. Take a signed evidence bundle.
  2. Modify any event or field.
  3. Delete the `signature` object or remove `signature.json` from the ZIP archive.
  4. Submit to verifier. Verifier returns `valid: true`.
- **Actual Impact**: Attackers can tamper with signed evidence bundles and evade signature invalidation simply by stripping the signature block. Automated systems inspecting `result.valid` treat the tampered bundle as valid.
- **Recommended Remediation**:
  1. Distinguish between verifying a legacy v1.0 unsigned stream vs. strict signature verification.
  2. Return `valid: false` for missing signatures unless the caller explicitly passes `{ allowUnsigned: true }`.
  3. Display an unambiguous warning in the UI when a bundle lacks a digital signature.
- **Required Regression Test**: Unit test verifying that omitting `signatureReceipt` returns `valid: false` when strict signature verification is demanded.
- **Verification Status**: **CONFIRMED VULNERABILITY**.

---

### SEC-004: Insecure Direct Object Reference (IDOR) on Workspace Queries
- **Finding ID**: SEC-004
- **Severity**: **High**
- **Affected Component**: `@evidencekit/evidence-server` (Incident & Graph Services)
- **Exact Source Location**:
  - `packages/evidence-server/src/services/incident-service.ts:183`
  - `apps/tracevault/app/api/evidence/graph/route.ts:9`
  - `apps/agentledger/app/api/agentledger/graph/route.ts:9`
- **Evidence**:
  ```typescript
  // incident-service.ts
  const query = IncidentQuerySchema.parse(rawQuery ?? {});
  const targetWorkspace = query.workspaceId || workspaceId;
  ...
  // graph routes
  const workspaceId = req.headers.get("x-workspace-id") || searchParams.get("workspaceId") || "default";
  ```
- **Reproduction / Validation Method**:
  Make a request to `GET /api/incidents?workspaceId=victim_enterprise_workspace` or `GET /api/evidence/graph?workspaceId=victim_enterprise_workspace`. The server returns incidents and agent sessions belonging to `victim_enterprise_workspace` without checking if the user belongs to that workspace.
- **Actual Impact**: Complete cross-tenant data leakage. Any tenant in a multi-workspace deployment can enumerate and read all incident titles, agent session goals, and tool execution logs of any other workspace.
- **Recommended Remediation**:
  1. Enforce workspace isolation strictly on the server by binding queries to the authenticated user's authorized workspace IDs.
  2. Ignore client-supplied `workspaceId` query parameters unless the authenticated user holds global administrator permissions.
- **Required Regression Test**: Test in `tests/evidence-graph.test.ts` verifying that querying a non-assigned workspace returns HTTP 403 Forbidden.
- **Verification Status**: **CONFIRMED VULNERABILITY**.

---

### SEC-005: Ephemeral Server Signing Key Generation on Startup
- **Finding ID**: SEC-005
- **Severity**: **Medium**
- **Affected Component**: `@evidencekit/evidence-server` (Export Bundle Service)
- **Exact Source Location**: `packages/evidence-server/src/services/export-bundle-service.ts:17–19`
- **Evidence**:
  ```typescript
  constructor(private chainService: ChainService = defaultChainService) {
    // Initialize default server-side Ed25519 signing key pair
    this.signingKeyPair = generateEd25519KeyPair("ek-signer-prod-2026");
  }
  ```
- **Reproduction / Validation Method**:
  Export a bundle, restart the Next.js dev server, and attempt to verify the exported bundle against the server's public key endpoint `/api/health` or public key service. The public key has changed, and previously exported receipts fail key validation.
- **Actual Impact**: Receipts generated prior to server restart or across different serverless worker instances have mismatched key IDs and fingerprints, breaking verification continuity across deployments.
- **Recommended Remediation**:
  1. Load private keys from `process.env.EVIDENCE_SIGNING_PRIVATE_KEY` and public keys from `process.env.EVIDENCE_VERIFY_PUBLIC_KEY`.
  2. Only generate in-memory ephemeral keys when explicitly configured in `development` or `test` modes, and emit an operational warning log.
- **Required Regression Test**: Unit test verifying that providing `EVIDENCE_SIGNING_PRIVATE_KEY` produces identical key fingerprints across multiple service instantiations.
- **Verification Status**: **CONFIRMED VULNERABILITY**.

---

### SEC-006: False Offline Verification Architecture
- **Finding ID**: SEC-006
- **Severity**: **Medium**
- **Affected Component**: `apps/tracevault` & `apps/agentledger` (Verify Bundle Pages)
- **Exact Source Location**:
  - `apps/tracevault/app/verify/page.tsx:31–34`
  - `apps/agentledger/app/verify/page.tsx:41–45`
- **Evidence**:
  Both pages display text assuring users of "independent verification without relying on server trust", but execute network calls:
  `fetch("/api/evidence/verify", { method: "POST", body: formData })`
  `fetch("/api/agentledger/verify", { method: "POST", body: JSON.stringify(parsed) })`
- **Reproduction / Validation Method**:
  1. Open `http://localhost:3001/verify` in browser.
  2. Disconnect network or stop Next.js dev server.
  3. Upload an evidence bundle and click "Verify".
  4. The page fails with a network fetch error and cannot verify the bundle.
- **Actual Impact**: Misleading claims to hackathon judges and users. True offline forensic verification is impossible without an active connection to the EvidenceKit backend.
- **Recommended Remediation**:
  Implement client-side verification directly in the browser using `@evidencekit/core` and the Web Cryptography API (`crypto.subtle`).
- **Required Regression Test**: Playwright test verifying bundle verification with mock network disconnection.
- **Verification Status**: **CONFIRMED VULNERABILITY**.

---

### SEC-007: Missing Workspace Parameter in Tool Call Route
- **Finding ID**: SEC-007
- **Severity**: **Medium**
- **Affected Component**: `apps/agentledger` (Tool Execution API)
- **Exact Source Location**: `apps/agentledger/app/api/agentledger/sessions/[id]/tool-call/route.ts:26–34`
- **Evidence**:
  ```typescript
  const result = await defaultAgentSandboxService.executeTool({
    sessionId: params.id,
    agentName: session.agentName,
    toolCallId: body.toolCallId,
    toolName: body.toolName,
    args: body.args || {},
    approvalId: body.approvalId,
    db
    // workspaceId is NOT passed here!
  });
  ```
- **Reproduction / Validation Method**:
  Create a custom policy for workspace `ws_custom`. Execute a tool call against a session belonging to `ws_custom`. The tool call is evaluated against the `default` workspace policy instead of `ws_custom`.
- **Actual Impact**: Custom tenant policies configured for specific agent sessions are ignored during tool execution, defaulting to the fallback global policy.
- **Recommended Remediation**:
  Pass `workspaceId: session.workspaceId` directly into `executeTool(...)`.
- **Required Regression Test**: Test in `tests/agent-policy.test.ts` verifying that tool execution respects session workspace policies.
- **Verification Status**: **CONFIRMED VULNERABILITY**.

---

### SEC-008: Unauthenticated Approval Request Injection
- **Finding ID**: SEC-008
- **Severity**: **Low**
- **Affected Component**: `apps/agentledger` (Approvals API)
- **Exact Source Location**: `apps/agentledger/app/api/agentledger/sessions/[id]/approvals/route.ts:42–55`
- **Evidence**:
  ```typescript
  if (body.approvalId && body.decision) {
    // Requires owner authorization
  } else {
    // Creates approval request WITHOUT calling requireOwnerAuthorization!
    const created = await defaultAgentApprovalService.requestApproval(...);
  }
  ```
- **Reproduction / Validation Method**:
  Send an unauthenticated `POST /api/agentledger/sessions/[id]/approvals` with `{ toolCallId: "tc_fake", toolName: "create_file" }`. The server creates a pending approval request.
- **Actual Impact**: Unauthenticated callers can flood the approval queue with spurious requests, transitioning agent sessions into `awaiting_approval` state (Denial of Service on agent workflow).
- **Recommended Remediation**:
  Require agent runtime authentication or session token verification before accepting approval requests.
- **Required Regression Test**: Test verifying that unauthenticated clients cannot inject approval requests into a running session.
- **Verification Status**: **LIKELY WEAKNESS**.

---

### SEC-009: Private Network Database Host IP in Committed Environment File
- **Finding ID**: SEC-009
- **Severity**: **Informational**
- **Affected Component**: Root Environment Configuration
- **Exact Source Location**: `.env:10`
- **Evidence**:
  `DATABASE_URL=postgresql://postgres:postgres@172.31.88.58:5432/evidencekit`
- **Reproduction / Validation Method**:
  Inspect `.env` file in repository root. The IP `172.31.88.58` is a local Hyper-V / WSL2 internal virtual network interface.
- **Actual Impact**: Exposes internal subnet structure; causes immediate test suite hangs and 500 errors when cloned on developer machines where WSL2 is not bound to that specific IP.
- **Recommended Remediation**:
  Default to `localhost:5432` in `.env.example`, and document WSL2 port forwarding in `POSTGRESQL_SETUP_GUIDE.md`.
- **Required Regression Test**: None (Configuration management).
- **Verification Status**: **INFORMATIONAL RECOMMENDATION**.

