# EvidenceKit Phase 5: Independent Test Results

**Date:** 2026-11-06  
**Test Engine:** Vitest v2.1.9 (Unit & Integration) + Playwright v1.48.2 (Chromium E2E)  
**PostgreSQL Instance:** PostgreSQL 18.6 on WSL2 Ubuntu (`172.31.88.58:5432/evidencekit`)  
**Total Tests Executed:** 114 tests  
**Total Tests Passed:** 114 tests (100% PASS rate)  
**Total Tests Failed:** 0  
**Total Skipped:** 0

---

## 1. Full Test Suite Matrix (29 Test Files)

### 1.1 Vitest Unit & Integration Suites (26 Test Files / 103 Tests)

|  #  | Test File                            | Tests Passed | Duration | Key Coverage / Invariants Tested                                                         |
| :-: | :----------------------------------- | :----------: | :------: | :--------------------------------------------------------------------------------------- |
|  1  | `tests/canonicalize.test.ts`         |    5 / 5     |   8 ms   | RFC 8785 JSON lexical sorting, float serialization, whitespace stripping, UTF-8 encoding |
|  2  | `tests/chain.test.ts`                |    7 / 7     |  12 ms   | Genesis hash, incremental SHA-256 updates, sequence validation, tamper detection         |
|  3  | `tests/property.test.ts`             |    4 / 4     |  144 ms  | Fast-check generative property tests for RFC 8785 idempotence and hash chain integrity   |
|  4  | `tests/redaction.test.ts`            |    6 / 6     |  10 ms   | Regex secret sanitization (API keys, JWT, passwords, SSN, credit cards) before hashing   |
|  5  | `tests/bundle-export.test.ts`        |    2 / 2     |  145 ms  | Export bundle generation, checksums, standalone validation, import roundtrip             |
|  6  | `tests/export.test.ts`               |    4 / 4     |  12 ms   | Portable JSON bundle structures, manifest verification, format constraints               |
|  7  | `tests/normalize.test.ts`            |    3 / 3     |  14 ms   | Event envelope schema validation, timestamp normalization, severity levels               |
|  8  | `tests/incident.test.ts`             |    8 / 8     |  46 ms   | Incident creation, workspace scoping, status transitions, retrieval                      |
|  9  | `tests/upload.test.ts`               |    8 / 8     |  124 ms  | Evidence upload, syslog RFC 5424 parsing, JSONL log parsing, Git commit extraction       |
| 10  | `tests/timeline.test.ts`             |    5 / 5     |   7 ms   | Sub-millisecond timeline queries, pagination, severity filtering, time bounding          |
| 11  | `tests/correlation.test.ts`          |    5 / 5     |   8 ms   | Candidate correlation generation, temporal grouping, non-causal disclaimer formatting    |
| 12  | `tests/report.test.ts`               |    2 / 2     |   7 ms   | Markdown & JSON incident investigation report generation with audit summaries            |
| 13  | `tests/adapters.test.ts`             |    4 / 4     |  17 ms   | Adapter interface contracts, metadata extraction, payload normalization                  |
| 14  | `tests/security-audit.test.ts`       |    6 / 6     |  485 ms  | Zip-bomb mitigation (42.zip rejection), compression ratio limit, payload size caps       |
| 15  | `tests/agent-sdk.test.ts`            |    1 / 1     |  15 ms   | Agent SDK instrumentation, tool execution wrapper, automatic event emission              |
| 16  | `tests/agent-approval.test.ts`       |    4 / 4     |  340 ms  | Server-side approval gates, denial enforcement, zero mutation, single-use anti-replay    |
| 17  | `tests/agent-sandbox.test.ts`        |    7 / 7     |  346 ms  | Tool allowlist enforcement, path traversal rejection (`../`), symlink escape blocking    |
| 18  | `tests/agent-session.test.ts`        |    4 / 4     |  763 ms  | Session state machine transitions, metadata tracking, controlled workflow execution      |
| 19  | `tests/agent-property.test.ts`       |    3 / 3     |  223 ms  | Generative property tests for agent ledger event ordering and authorization tokens       |
| 20  | `tests/agentledger-e2e.test.ts`      |    2 / 2     |  685 ms  | Complete AgentLedger backend lifecycle: session, tool calls, approval, replay, export    |
| 21  | `tests/tracevault-e2e.test.ts`       |    1 / 1     |  269 ms  | Complete TraceVault backend lifecycle: incident creation, multi-source ingestion, verify |
| 22  | `tests/postgres-persistence.test.ts` |    1 / 1     |  231 ms  | Physical PostgreSQL CRUD, foreign keys, transaction rollbacks, restart survival          |
| 23  | `tests/infrastructure.test.ts`       |    5 / 5     |   8 ms   | Database connection pooling, health check endpoints, environment variable loading        |
| 24  | `tests/performance.test.ts`          |    1 / 1     |  79 ms   | 1,000-event hash-chain throughput, verification speed, paginated queries                 |
| 25  | `tests/tracevault-scale.test.ts`     |    2 / 2     | 1192 ms  | 1,000 and 10,000 incident event scale benchmarks (ingestion, chaining, verification)     |
| 26  | `tests/agent-scale.test.ts`          |    3 / 3     | 2029 ms  | 100 sequential tool calls, 250-event deterministic replay, 1,000-event scale invariance  |

**Vitest Subtotal:** **103 passed / 103 tests** across **26 test files** (Duration: 5.31s).

---

### 1.2 Playwright Chromium E2E Suites (3 Spec Files / 11 Tests)

|  #  | Spec File                 | Tests Passed | Duration | Scenario Verified                                                                                          |
| :-: | :------------------------ | :----------: | :------: | :--------------------------------------------------------------------------------------------------------- |
| 27  | `e2e/agentledger.spec.ts` |    3 / 3     |  4.2 s   | Landing metrics, wizard session creation, demo runner, approvals, timeline, diffs, replay, export          |
| 28  | `e2e/tracevault.spec.ts`  |    2 / 2     |  2.0 s   | Landing metrics, incident lifecycle, fixture upload, timeline, provenance modal, report, export, `/verify` |
| 29  | `e2e/responsive.spec.ts`  |    6 / 6     |  6.0 s   | Responsive layout, navigation, zero overflow at 1440px desktop, 768px tablet, 390px mobile                 |

**Playwright Subtotal:** **11 passed / 11 tests** across **3 spec files** (Duration: 18.6s).

---

## 2. Benchmark Measurement Details

### 2.1 Core Cryptographic Throughput

- **1,000 Event Append & Hash:** 18.57 ms (**53,859 events/sec**)
- **1,000 Event Chain Verification:** 16.88 ms (**59,249 events/sec**)
- **10,000 Event Append & Hash:** 162.72 ms (**61,456 events/sec**)
- **10,000 Event Chain Verification:** 138.12 ms (**72,401 events/sec**)

### 2.2 Query & Retrieval Latency

- **Timeline Query (50 items paginated, 1,000 events):** 0.71 ms
- **Filtered Timeline Query (10,000 events):** 0.66 ms
- **Provenance Lookup by Event Hash:** < 1 ms

### 2.3 Sandboxed Agent Execution & Replay

- **200 Sandboxed File Operations (100 creates + 100 hashes):** 1.38 s total (~6.9 ms per tool execution)
- **Replay State Reconstruction (250 events):** < 100 ms

---

## 3. Responsive Layout & Browser Console Diagnostics

All 11 browser test runs were inspected for runtime warnings, console errors, and CSS rendering anomalies:

- **TraceVault Desktop (1440x900):** No console errors; `document.documentElement.scrollWidth === 1440`.
- **TraceVault Tablet (768x1024):** No console errors; layout collapsed cleanly to single-column flex; no horizontal scrollbar.
- **TraceVault Mobile (390x844):** Header menu and cards stacked vertically; timeline cards wrap without clipping; no horizontal scrollbar.
- **AgentLedger Desktop (1440x900):** No console errors; multi-panel layout rendered crisply; replay scrubber fully visible.
- **AgentLedger Tablet (768x1024):** Tabs scroll horizontally without breaking page flow; zero overflow.
- **AgentLedger Mobile (390x844):** Hero action buttons wrap cleanly; approval decision cards adapt; zero overflow.

All 6 screenshots were validated and stored in `test-results/screenshots/`.
