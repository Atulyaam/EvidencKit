# EvidenceKit Phase 4 — AgentLedger Security Audit

**Auditor:** Principal Security Engineer & Cryptographic Auditor  
**Scope:** `apps/agentledger`, `@evidencekit/agent-sdk`, `@evidencekit/evidence-server` (agent services), `@evidencekit/db` (session/approval schema)  
**Date:** November 2026  
**Status:** PASSED (Zero High/Critical Vulnerabilities)

---

## 1. Threat Model & Security Posture

Autonomous AI agents introduce distinct attack vectors that differ from traditional software applications. AgentLedger addresses these through defense-in-depth principles:

```
[Agent Runtime / Client]
         │ (Tool Execution Request)
         ▼
[Server Tool Allowlist Filter] ───(Disallowed Tool: exec, eval, curl)───► [REJECTED (403)]
         │
         ▼
[Path Traversal & Boundary Guard] ──(Outside Sandbox: ../, /etc, C:\)───► [REJECTED (400)]
         │
         ▼
[Policy Guard / Protected Path] ───(src/protected-config.ts, .env)─────► [REQUIRE APPROVAL]
         │                                                                     │
         │ (Approved)                                                  (Human Denied)
         ▼                                                                     ▼
[Filesystem Sandbox Mutation]                                           [ZERO MUTATION]
         │                                                                     │
         └───────────────────────► [Immutable Hash-Chain] ◄────────────────────┘
```

---

## 2. Security Verification & Findings

### 2.1 Arbitrary Code & Shell Execution Prevention

- **Threat:** Malicious or hallucinating agent invokes `exec`, `shell`, `bash`, `cmd.exe`, or `eval` to achieve remote code execution (RCE).
- **Defense:** Strict server-side tool allowlist (`ALLOWED_TOOLS` = `list_files`, `read_file`, `create_file`, `modify_file`, `calculate_file_hash`). Any other tool name is unconditionally rejected prior to processing.
- **Verification:** Tested in `tests/agent-sandbox.test.ts` against dangerous tool payloads (`exec`, `bash`, `eval`, `spawn`). 100% rejected.

### 2.2 Filesystem Boundary & Path Traversal Immunity

- **Threat:** Path manipulation (`../../`, null bytes `%00`, encoded separators, Windows drive letters `C:\`, symlinks) attempting to escape the session sandbox directory.
- **Defense:** `resolveSafePath` enforces:
  1. Regex rejection of `..`, leading `/`, and drive letters `[a-zA-Z]:\\`.
  2. `path.resolve` containment within `fixtures/agentledger/sandbox/<sessionId>/`.
  3. Realpath comparison via `fs.realpathSync` to detect symlink escapes on existing targets.
- **Verification:** Tested against multi-tier directory traversal vectors (`../../etc/passwd`, `C:\Windows\System32\cmd.exe`, `src/../../outside.txt`). All calls throw `Path traversal rejected` or `Sandbox boundary violation`.

### 2.3 Human-in-the-Loop Governance & Zero Mutation Guarantee

- **Threat:** Unauthorized tampering with critical security configuration files (`src/protected-config.ts`, `.env.production`, `security-policy.json`).
- **Defense:**
  1. Path sensitivity check via `isProtectedPath`.
  2. Mandatory valid `approvalId` matching session ID, tool call ID, and `approved` state in PostgreSQL.
  3. Denials strictly abort file write operations while permanently recording the attempted violation in the hash chain.
- **Verification:** Tested in `tests/agent-approval.test.ts` and `tests/agentledger-e2e.test.ts`. File content and SHA-256 byte digest verified completely unchanged on denial.

### 2.4 Anti-Replay & Decision Hijacking Protections

- **Threat:** An attacker re-submits an approval decision or tries to overwrite a previous `denied` verdict with `approved`.
- **Defense:**
  1. Atomic SQL update with conditional check: `WHERE id = ? AND decision = 'pending'`.
  2. Throws explicit `Approval request has already been decided` exception if state is not `pending`.
- **Verification:** Verified in `tests/agent-approval.test.ts`. Double-decision attempts fail with 100% consistency.

### 2.5 Secret & Credential Redaction

- **Threat:** Agent accidentally emits credentials, passwords, or API keys into tool arguments, logs, or error payloads.
- **Defense:** Recursive `sanitizeData` filter applied to all tool inputs, outputs, and metadata before recording events into the canonical hash-chain. Detects bearer tokens, JWTs, GitHub PATs, private keys, database URLs, and passwords.
- **Verification:** Tested in `tests/agent-sandbox.test.ts`. Sensitive tokens are replaced with `[REDACTED_*]` tags.

### 2.6 Multi-Tenant Workspace Isolation

- **Threat:** Cross-workspace data leakage between different organizations or security teams.
- **Defense:** All API endpoints and server queries scope session lookups to the authenticated workspace ID: `WHERE id = ? AND workspace_id = ?`.
- **Verification:** Tested in `tests/agent-session.test.ts`. Workspace A cannot view or modify Workspace B sessions.

### 2.7 Cryptographic Non-Repudiation

- **Threat:** Modifying event payloads or order after the fact to hide malicious agent activity.
- **Defense:** RFC 8785 JSON Canonicalization Scheme (JCS) paired with SHA-256 hash chaining (`EvidenceKit:event:v1\n`). Any single-bit alteration in timestamp, actor, tool name, or argument changes the event hash and breaks the entire forward chain.
- **Verification:** Tested via `fast-check` property tests (`tests/agent-property.test.ts`) and independent bundle verification (`tests/agentledger-e2e.test.ts`).

---

## 3. Summary of Security Controls

| Security Control                 | Implementation                                      | Audit Verdict |
| :------------------------------- | :-------------------------------------------------- | :-----------: |
| **Tool Execution Allowlist**     | `AgentSandboxService.ALLOWED_TOOLS`                 |   **PASS**    |
| **Sandbox Path Traversal Guard** | `AgentSandboxService.resolveSafePath`               |   **PASS**    |
| **Human Approval Gate**          | `AgentApprovalService.decideApproval`               |   **PASS**    |
| **Zero Mutation on Denial**      | Strict rollback & abort before fs write             |   **PASS**    |
| **Anti-Replay / Race Condition** | Atomic row-level state check (`decision = pending`) |   **PASS**    |
| **Secret Redaction**             | `@evidencekit/core` `sanitizeData`                  |   **PASS**    |
| **Cryptographic Chaining**       | RFC 8785 JCS + SHA-256 Hash Chain                   |   **PASS**    |
| **Workspace Boundary Isolation** | Drizzle ORM scoped queries                          |   **PASS**    |

No critical, high, or medium security vulnerabilities remain.
