# EvidenceKit Phase 5: Security Findings & Threat Model Verification

**Date:** 2026-11-06  
**Auditor:** Application Security & Cryptographic Systems Auditor  
**System Evaluated:** EvidenceKit (TraceVault + AgentLedger)  
**Status:** ALL SECURITY CONTROLS VERIFIED & EFFECTIVE

---

## 1. Security Architecture & Threat Vectors

EvidenceKit operates as a security-critical verifiable audit engine and incident reconstruction platform. The security audit evaluated nine primary threat vectors across the monorepo:

```
+-----------------------------------------------------------------------------------------+
|                                    SECURITY BOUNDARIES                                  |
+-----------------------------------------------------------------------------------------+
|  [Ingestion / Upload]  -->  [Sanitization & Redaction]  -->  [RFC8785 Canonicalizer]   |
|            |                                                               |            |
|     (Zip-Bomb Defense)                                             (SHA-256 Hash Chain) |
|            v                                                               v            |
|  [Agent Sandbox Isolation] <--> [Human Approval Gate]   -->  [PostgreSQL Append Store]  |
|            |                             |                                 |            |
|     (Path Traversal /             (Anti-Replay /                    (Row-Locking /      |
|      Symlink Blocker)              Zero Mutation)                    Workspace Isolated)|
+-----------------------------------------------------------------------------------------+
```

---

## 2. Threat Vector Evaluation & Mitigations

### 2.1 Cryptographic Tamper Resistance

- **Threat:** An attacker or malicious insider modifies historical event attributes, reorders events, deletes an event, or inserts a backdated record in the database.
- **Mitigation Tested:**
  - Every event payload is canonicalized using RFC 8785, eliminating JSON property reordering or whitespace ambiguity.
  - Continuous SHA-256 hash chaining binds each event:  
    `H(n) = SHA256(H(n-1) || Canonicalize(Event_n))`
  - Genesis events are anchored to `0000000000000000000000000000000000000000000000000000000000000000`.
- **Verification Result:** PASS (`tests/chain.test.ts`, `tests/property.test.ts`). Any modification to a single character in a payload, a sequence number, or a previous hash breaks downstream hashes and is identified immediately with the exact sequence offset.

### 2.2 Sensitive Data Exposure (Credential / Secret Leakage)

- **Threat:** Evidence logs containing API keys, private tokens, passwords, or PII are committed to the immutable event ledger or exported into evidence bundles.
- **Mitigation Tested:**
  - Automated regex-driven redaction runs across event payloads before canonicalization and hashing.
  - Secret patterns covered: Bearer tokens, OpenAI/Anthropic/AWS/GitHub API keys (`sk-...`, `ghp_...`, `AKIA...`), database connection URIs, credit card numbers, Social Security Numbers, and common auth passwords.
- **Verification Result:** PASS (`tests/redaction.test.ts`). Sensitive strings are replaced with `[REDACTED_API_KEY]`, `[REDACTED_SECRET]`, etc. Cryptographic verification remains intact across sanitized payloads.

### 2.3 Agent Sandbox Path Traversal & Symlink Escapes

- **Threat:** An autonomous agent, prompted or hijacked by prompt injection, attempts to write or read system files outside its assigned sandbox (e.g., `../../etc/shadow` or `C:\Windows\System32`).
- **Mitigation Tested:**
  - `AgentSandboxService` enforces path resolution inside `sandboxDir = /tmp/agentledger-sandbox/{sessionId}`.
  - Any resolved path not starting with the normalized canonical sandbox root triggers an immediate security error: `FORBIDDEN_PATH_TRAVERSAL`.
  - Absolute path arguments (e.g. `/etc/passwd`, `C:\autoexec.bat`) and attempts to follow symlinks out of the jail are blocked prior to filesystem operations.
- **Verification Result:** PASS (`tests/agent-sandbox.test.ts`). All traversal variants tested failed safely.

### 2.4 Server-Side Human Approval Gates & Zero Mutation

- **Threat:** High-risk actions (e.g. destructive file writes, commands) bypass client-side modals and execute without approval, or an agent mutates the workspace despite a human "deny" decision.
- **Mitigation Tested:**
  - Pre-execution validation checks whether a tool requires approval (`file_write`, `delete_file`, `shell_command`).
  - The runtime pauses and registers an approval request with status `pending`.
  - If rejected or denied, `AgentSandboxService` explicitly halts and returns `{ success: false, reason: "Operation was denied by user" }`.
  - The file modification is never executed, and an immutable `agent.approval.decided` event is recorded.
- **Verification Result:** PASS (`tests/agent-approval.test.ts`, `tests/agentledger-e2e.test.ts`). Tested denying a file update; verified target file content remained 100% untouched and hash chain verified.

### 2.5 Approval Anti-Replay & Double-Decision Prevention

- **Threat:** An attacker re-submits a previously approved token to authorize unauthorized tool calls, or changes a "denied" decision back to "approved".
- **Mitigation Tested:**
  - Approval IDs are single-use.
  - State machine enforces that once an approval record is transitioned to `approved` or `rejected`/`denied`, subsequent decision attempts return `400 Bad Request / APPROVAL_ALREADY_DECIDED`.
- **Verification Result:** PASS (`tests/agent-approval.test.ts`). Replayed tokens and double-decisions are rejected.

### 2.6 Multi-Tenant Workspace Isolation

- **Threat:** Users in workspace A query, view, or mutate incidents or agent sessions belonging to workspace B.
- **Mitigation Tested:**
  - All database queries for `cases`, `agent_sessions`, and `events` enforce `where(eq(table.workspaceId, currentWorkspaceId))`.
  - Foreign key constraints cascade deletes within the workspace scope.
- **Verification Result:** PASS (`tests/incident.test.ts`, `tests/postgres-persistence.test.ts`). Cross-workspace queries consistently return 0 results.

### 2.7 Zip-Bomb & Denial-of-Service (DoS) Ingestion Protection

- **Threat:** An attacker uploads a crafted recursive zip archive or decompresses a high-ratio gzip/zip bomb during evidence upload to cause CPU/memory starvation.
- **Mitigation Tested:**
  - Zip upload parser enforces strict guardrails:
    1. Maximum file count: 1,000 files.
    2. Maximum uncompressed size: 50 MB total.
    3. Maximum compression ratio: 100:1.
    4. Streaming size checks that terminate parsing if limits are exceeded.
- **Verification Result:** PASS (`tests/security-audit.test.ts`). Standard recursive zip bomb payloads (`42.zip`) and oversized archives are intercepted and rejected cleanly.

### 2.8 Database Credential Hygiene & Environment Security

- **Threat:** PostgreSQL connection strings containing plain-text passwords or secret keys are checked into source control or exposed in client bundles.
- **Mitigation Tested:**
  - Repository scan for hardcoded credentials.
  - Database URLs are loaded exclusively through server-side environment variables (`DATABASE_URL`, `POSTGRES_HOST`, `POSTGRES_USER`, etc.).
  - Next.js client-facing code strictly excludes server environment variables; only public flags (`NEXT_PUBLIC_*`) are exposed.
- **Verification Result:** PASS. No database passwords or secrets exist in the git repository.

### 2.9 Causality Misattribution Prevention

- **Threat:** Investigators confuse automated correlation links with deterministic causal links during incident post-mortems.
- **Mitigation Tested:**
  - The UI and investigation reports explicitly declare candidate correlations as **"non-causal candidate links"** with statistical confidence indicators rather than asserting root causation.
- **Verification Result:** PASS (`tests/correlation.test.ts`, `e2e/tracevault.spec.ts`).

---

## 3. Vulnerability Summary Table

| Vulnerability Category           | Severity |    Status     | Verification Reference                          |
| :------------------------------- | :------: | :-----------: | :---------------------------------------------- |
| Hash-Chain Tampering             | CRITICAL | **MITIGATED** | `tests/chain.test.ts`, `tests/property.test.ts` |
| Sandbox Directory Traversal      | CRITICAL | **MITIGATED** | `tests/agent-sandbox.test.ts`                   |
| Approval Bypass / Replay         |   HIGH   | **MITIGATED** | `tests/agent-approval.test.ts`                  |
| Zip-Bomb DoS Ingestion           |   HIGH   | **MITIGATED** | `tests/security-audit.test.ts`                  |
| Cross-Workspace Leakage          |   HIGH   | **MITIGATED** | `tests/postgres-persistence.test.ts`            |
| Secret / PII Ingestion           |  MEDIUM  | **MITIGATED** | `tests/redaction.test.ts`                       |
| Concurrent Append Race Condition |  MEDIUM  | **MITIGATED** | `tests/postgres-persistence.test.ts`            |
| Insecure Replay Execution        |   HIGH   | **MITIGATED** | `tests/agentledger-e2e.test.ts`                 |

---

## 4. Security Auditor Verdict

The EvidenceKit architecture satisfies all security invariants outlined in the Kiroween 2026 specification. No critical, high, or medium severity vulnerabilities were found.
