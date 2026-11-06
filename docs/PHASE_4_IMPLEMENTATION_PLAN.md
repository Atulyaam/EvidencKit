# Phase 4: AgentLedger — Implementation Plan & Architecture Specification

**Project:** EvidenceKit  
**Component:** AgentLedger (AI Agent Activity Auditing Platform)  
**Author:** Principal Software Architect & Senior Full-Stack Engineer  
**Date:** 2026-11-06  
**Status:** IN PROGRESS (Autonomously Executing)

---

## 1. Executive Summary & Architecture Overview

AgentLedger is an AI-agent activity auditing application powered by the reusable EvidenceKit event-evidence engine. It provides immutable, tamper-evident recording and inspection of autonomous and semi-autonomous AI coding agent workflows.

### Primary Objectives:

1. **Agent Session Management:** Robust lifecycle state machine (`running`, `paused`, `awaiting_approval`, `completed`, `failed`, `cancelled`) with PostgreSQL persistence and workspace isolation.
2. **Safe Demonstration Agent & Sandbox:** Deterministic simulated agent operating in a strictly bounded sandbox workspace (`fixtures/agentledger/sandbox/`). Zero arbitrary code/shell execution; strict tool allowlist (`list_files`, `read_file`, `create_file`, `modify_file`, `calculate_file_hash`).
3. **Tool-Call Lifecycle Instrumentation:** Full lifecycle recording via `@evidencekit/agent-sdk` (`agent.tool.started`, `agent.tool.completed`, `agent.tool.failed`) with secret redaction and correlation IDs.
4. **Server-Side Approval & Denial Engine:** Mandatory policy enforcement where sensitive file changes or protected resources require human approval. Denied actions NEVER execute and produce zero filesystem changes, while recording the denial cryptographically in the evidence chain.
5. **File Change & Diff Tracking:** Relative path recording, before/after SHA-256 hashes computed from real file bytes, bounded diff metadata, and provenance linking.
6. **Timeline & Replay Reconstruction:** Unified chronological timeline and deterministic step-by-step session replay reconstructed exclusively from recorded events (without re-executing tools).
7. **Portable Evidence Export & Verification:** Cryptographically verifiable JSON export bundles adhering to EvidenceKit RFC8785 canonical specifications.
8. **Professional UI:** Developer-grade dark-themed web interface in `apps/agentledger` with comprehensive views for sessions, timeline, replay, approvals, files, and verification.

---

## 2. Component Design & Shared Package Integration

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        apps/agentledger                                │
│  ┌───────────────┐ ┌────────────────┐ ┌────────────────┐ ┌───────────┐ │
│  │ Session List  │ │ Timeline View  │ │ Replay Player  │ │ Approvals │ │
│  └───────────────┘ └────────────────┘ └────────────────┘ └───────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST APIs
┌───────────────────────────────────▼────────────────────────────────────┐
│                   packages/evidence-server                             │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────┐  │
│  │ AgentSessionService  │ │ AgentApprovalService │ │ SandboxManager │  │
│  └──────────────────────┘ └──────────────────────┘ └────────────────┘  │
└───────┬───────────────────────────┬───────────────────────────┬────────┘
        │                           │                           │
┌───────▼──────────────┐   ┌────────▼──────────────┐   ┌────────▼────────┐
│ packages/agent-sdk   │   │ packages/evidence-core│   │ packages/db     │
│ AgentSessionRecorder │   │ Canonicalize / Hash   │   │ Drizzle Schema  │
│ Tool Lifecycle Hooks │   │ Chain / Export Verify │   │ PostgreSQL Pool │
└──────────────────────┘   └───────────────────────┘   └─────────────────┘
```

---

## 3. Detailed Work Breakdown (Tasks 4.1 to 4.15)

### Task 4.1 — Repository Audit & Implementation Plan

- Audit routes, database schema, SDK, and shared components.
- Establish `PHASE_4_IMPLEMENTATION_PLAN.md` and `PHASE_4_EXECUTION_TRACKER.md`.

### Task 4.2 — Agent Session Management

- Implement `AgentSessionService` supporting:
  - Create session, start, pause, complete, fail, cancel.
  - State machine transition validation.
  - PostgreSQL persistence (`agent_sessions` table).
  - Workspace isolation and role-based access control.

### Task 4.3 — Safe Demonstration Agent & Sandbox Boundary

- Implement `AgentSandboxManager`:
  - Enforce sandbox root directory (`fixtures/agentledger/sandbox/`).
  - Canonical path resolution; reject path traversal (`../`, absolute paths, symlinks).
  - Enforce tool allowlist (`list_files`, `read_file`, `create_file`, `modify_file`, `calculate_file_hash`).
  - Strict policy check for protected files (`src/protected-config.ts`).

### Task 4.4 — Agent Tool-Call Instrumentation

- Upgrade `AgentSessionRecorder` in `@evidencekit/agent-sdk`:
  - Full lifecycle methods: requested, started, completed, failed.
  - Secret redaction before evidence persistence.
  - Link session, tool call, approval, and evidence event.

### Task 4.5 — Approval & Denial Engine

- Implement `AgentApprovalService`:
  - Server-side approval policy evaluation.
  - Approval persistence in `agent_approvals` table.
  - Exactly-once approval enforcement (reject duplicate, replay, cross-session).
  - Verification that denied actions never execute and leave filesystem untouched.

### Task 4.6 — File Change Tracking

- Compute real SHA-256 hashes of pre-change and post-change file contents.
- Generate bounded diffs.
- Link file changes to tool call IDs and evidence chain.

### Task 4.7 — Agent Activity Timeline

- Query, filter, and paginate session events.
- Filters: event type, tool, status, search query.
- Maintain chronological order with cryptographic sequence preservation.

### Task 4.8 — Deterministic Session Replay

- Implement replay state machine: Play, Pause, Step Forward, Step Backward, Jump to Step.
- Reconstruct recorded actions from persisted events WITHOUT executing tools or modifying files.

### Task 4.9 — Session Evidence Export & Import Verification

- Create EvidenceKit portable export bundle (`agentledger.session`).
- Manifest, canonical chained events, approval decisions, file changes, verification report.
- Verify exported bundles; reject tampered bundles.

### Task 4.10 — AgentLedger User Interface

- Implement all pages and components in `apps/agentledger`:
  - `/`: Overview dashboard with session metrics.
  - `/sessions`: Searchable, filterable session list.
  - `/sessions/new`: Session creation wizard.
  - `/sessions/[id]`: Session overview & controls.
  - `/sessions/[id]/timeline`: Interactive chronological timeline.
  - `/sessions/[id]/replay`: Step-by-step history replay player.
  - `/sessions/[id]/approvals`: Approval request inspection & decision gates.
  - `/sessions/[id]/files`: File modification inspector with diff view.
  - `/sessions/[id]/export`: Bundle export and download.
  - `/verify`: Independent bundle integrity verification tool.

### Task 4.11 — Database Schema & Persistence

- Verify and update `agent_sessions` and `agent_approvals` in `packages/db`.
- Run migrations via `pnpm db:generate` & `pnpm db:migrate`.
- Ensure cascade deletes and proper foreign keys.

### Task 4.12 — Security Audit & Hardening

- Comprehensive security test suite:
  - Unauthorized session access & cross-workspace tampering.
  - Path traversal and symlink sandbox escapes.
  - Approval replay attacks and race conditions.
  - Secret redaction in event payloads.
  - Read-only enforcement in Public Judge Mode.

### Task 4.13 — Performance Benchmarks

- Benchmark 100 tool calls, 1,000 tool calls, 10,000 events.
- Timeline query and pagination latencies.
- Replay reconstruction and export verification benchmarks.

### Task 4.14 — Comprehensive Automated Testing

- Unit tests, integration tests against real PostgreSQL.
- Property-based tests via `fast-check`.
- Playwright Chromium E2E browser tests.

### Task 4.15 — Demonstration Scenario & Fixtures

- Pre-configured demo workflow in `fixtures/agentledger/`.
- 10-step repeatable scenario verifying safe edits, approval request, human approval, protected file denial, and export verification.

---

## 4. Definition of Done

1. All 15 tasks completed and independently verified.
2. 100% test pass rate across unit, integration, security, and E2E suites.
3. PostgreSQL physical persistence confirmed.
4. Clean build across all packages and both applications (`apps/tracevault` and `apps/agentledger`).
5. Complete documentation delivered.
