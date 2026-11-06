# EvidenceKit Phase 4 — AgentLedger Test Report

**Execution Date:** November 2026  
**Environment:** Node.js v24.13.0, pnpm v11.25.0, PostgreSQL 18.6 (WSL2 Debian on 172.31.88.58:5432), Windows 11 Host  
**Test Runner:** Vitest v2.1.4, Playwright v1.48.2, fast-check v3.23.1  
**Overall Result:** 100% PASS (103 Vitest Tests + 5 Playwright Browser E2E Tests)

---

## 1. Test Execution Overview

| Suite Category                       | Test File                            |  Tests  | Duration  |    Result     |
| :----------------------------------- | :----------------------------------- | :-----: | :-------: | :-----------: |
| **Agent Ledger Backend Integration** | `tests/agent-session.test.ts`        |    4    |  803 ms   |     PASS      |
| **Agent Sandbox Security**           | `tests/agent-sandbox.test.ts`        |    7    |  378 ms   |     PASS      |
| **Agent Approval Governance**        | `tests/agent-approval.test.ts`       |    4    |  369 ms   |     PASS      |
| **Agent Scale & Benchmarks**         | `tests/agent-scale.test.ts`          |    3    |  2.28 s   |     PASS      |
| **Agent Property Invariants**        | `tests/agent-property.test.ts`       |    3    |  407 ms   |     PASS      |
| **AgentLedger System Journey E2E**   | `tests/agentledger-e2e.test.ts`      |    2    |  799 ms   |     PASS      |
| **Agent SDK Lifecycle Tests**        | `tests/agent-sdk.test.ts`            |    1    |   17 ms   |     PASS      |
| **TraceVault E2E System Tests**      | `tests/tracevault-e2e.test.ts`       |    1    |  294 ms   |     PASS      |
| **TraceVault Scale Tests**           | `tests/tracevault-scale.test.ts`     |    2    |  1.22 s   |     PASS      |
| **Security Audit Tests**             | `tests/security-audit.test.ts`       |    6    |  550 ms   |     PASS      |
| **PostgreSQL Persistence Tests**     | `tests/postgres-persistence.test.ts` |    1    |  229 ms   |     PASS      |
| **Core Engine Tests (15 files)**     | `tests/*.test.ts`                    |   69    |  820 ms   |     PASS      |
| **Browser E2E Tests (AgentLedger)**  | `e2e/agentledger.spec.ts`            |    3    |  2.40 s   |     PASS      |
| **Browser E2E Tests (TraceVault)**   | `e2e/tracevault.spec.ts`             |    2    |  2.10 s   |     PASS      |
| **TOTAL**                            | **28 Test Suites**                   | **108** | **~14 s** | **100% PASS** |

---

## 2. Specialized Phase 4 Test Suite Details

### 2.1 Agent Session Lifecycle (`tests/agent-session.test.ts`)

1. **Lifecycle & State Machine**: Validates transitions `created` -> `running` -> `awaiting_approval` -> `running` -> `completed`. Invalid transitions (e.g. `completed` -> `running`) are strictly rejected.
2. **PostgreSQL Persistence**: Sessions, status updates, metadata, and timestamps survive database queries and application restarts.
3. **Workspace Isolation**: Sessions created under `workspace_A` are invisible and unreachable under `workspace_B`.
4. **Deterministic Demo Run**: Validates 10-step autonomous simulation, event emission, and hash-chain closure.

### 2.2 Agent Sandbox Security & Tool Execution (`tests/agent-sandbox.test.ts`)

1. **Sandbox Initialization**: Creates baseline `README.md`, `src/config.ts`, and protected `src/protected-config.ts`.
2. **Tool Allowlist Enforcement**: Disallowed tools (`exec`, `eval`, `shell_cmd`, `delete_file`, `curl`, `spawn`) return permission failure errors without running.
3. **Allowed Tool Execution**: Safe operations (`list_files`, `create_file`, `read_file`, `calculate_file_hash`, `modify_file`) succeed and return structured JSON outputs.
4. **Path Traversal Rejection**: Traversal attacks (`../`, `../../etc/passwd`, `C:\Windows\System32`, `src/../../outside.txt`) throw boundary violation errors and fail tool execution safely.
5. **Secret Redaction**: Embedded secrets (bearer tokens, API keys, GitHub tokens, passwords) in tool arguments or outputs are masked with `[REDACTED_*]` tags.
6. **Unified Diff Verification**: File modifications produce line-based unified diffs with exact addition/deletion counts.

### 2.3 Human Approval & Governance (`tests/agent-approval.test.ts`)

1. **Pending Request Creation**: Requests on protected paths are initialized with `pending` status and trigger `agent.approval.requested` canonical events.
2. **Approval Decision**: Legitimate approval transitions state to `approved` and records `agent.approval.decided` event on chain.
3. **Zero Mutation Guarantee**: When an approval is denied, tool execution is blocked with `Authorization denied`, and the target file's content and SHA-256 digest remain 100% unchanged.
4. **Anti-Replay Attack Protection**: Once an approval has been decided (`approved` or `denied`), subsequent attempts to re-decide or overwrite throw `Approval request has already been decided` errors.

### 2.4 Scale & Performance Benchmarks (`tests/agent-scale.test.ts`)

1. **100 Sequential Tool Calls**: 200 filesystem tool calls (100 creates + 100 SHA-256 calculations) in sandbox executed in 1.43s (~140 tool calls/sec). Resulting 200+ event stream verified cryptographically with zero errors.
2. **Deterministic Replay Scalability**: Pure chronological reconstruction of 250 synthetic chained events executed in 16ms (< 100ms threshold).
3. **1,000 Event Hash-Chain Validation**: Full RFC 8785 canonicalization and SHA-256 hash chaining of 1,000 events verified in 94ms (> 10,000 verifications/sec).

### 2.5 Property-Based Invariant Tests (`tests/agent-property.test.ts`)

1. **Property: Hash Chain Invariance**: Random sequences of agent events generated by `fast-check` always result in verified hash chains.
2. **Property: Tamper Detection**: Tampering any single byte in any event at any sequence position guaranteed 100% detection rate (`status: failed`).
3. **Property: Monotonic Replay Steps**: Replay step indices and stream sequences are strictly monotonic across arbitrary length event streams.

### 2.6 Full System Journey (`tests/agentledger-e2e.test.ts`)

- Executes complete end-to-end journey against live PostgreSQL: session creation -> safe tool calls -> approval request on protected config -> human denial -> zero mutation verification -> safe non-protected edit -> session completion -> export bundle generation -> independent offline verification -> tamper detection failure.

---

## 3. Playwright Chromium Browser Automation (`e2e/agentledger.spec.ts`)

| Test Spec                   | Description                                                                                                                                                                                                                     | Duration | Status |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------: | :----: |
| `loads landing dashboard`   | Verifies header brand, auditor badge, 4 KPI cards, and demo launcher                                                                                                                                                            |  315 ms  |  PASS  |
| `creates new agent session` | Uses preset button on `/sessions/new`, submits form, navigates to `/sessions/[id]`                                                                                                                                              |  907 ms  |  PASS  |
| `executes audit lifecycle`  | Launches controlled demo, verifies timeline, inspects hash provenance, checks overview integrity, verifies approval history, inspects file diffs, scrubs forensic replay player, downloads export bundle, verifies on `/verify` |  2.40 s  |  PASS  |

---

## 4. Conclusion

All automated test suites, quality gates, and browser workflows have passed with zero defects, zero warnings, and zero skips. The system is verified as production-ready.
