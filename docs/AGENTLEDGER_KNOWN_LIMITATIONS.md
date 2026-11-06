# AgentLedger — Known Limitations & Architectural Boundaries

This document details intentional design boundaries, trade-offs, and known scope limitations for **AgentLedger** in Phase 4.

---

## 1. Intentional Architectural Scope

### 1.1 Tool Allowlist Strictness

- **Design:** AgentLedger strictly allows 5 safe filesystem tools: `list_files`, `read_file`, `create_file`, `modify_file`, and `calculate_file_hash`.
- **Reason:** Arbitrary shell execution (`exec`, `bash`, `powershell`) or arbitrary code evaluation (`eval`, `node -e`) is completely forbidden by design. An auditing platform must never permit untrusted agent code execution without full kernel-level container sandboxing (e.g. gVisor, Firecracker), which is beyond the scope of a web-layer auditing engine.

### 1.2 Isolated Local Filesystem Sandbox

- **Design:** Sandboxed files are maintained in `fixtures/agentledger/sandbox/<sessionId>/`.
- **Limitation:** In the current demonstration architecture, the sandbox operates on local host storage rather than remote S3/GCS buckets. For multi-node distributed deployments, a persistent volume claim or cloud blob storage adapter can replace the local directory provider.

### 1.3 Pure Replay vs Live Re-Execution

- **Design:** The forensic replay player (`/sessions/[id]/replay`) is a **pure historical state reconstructor**.
- **Explanation:** Replay reduces over the recorded canonical event log to render historical tool invocations, approvals, and file states. It intentionally **does not** re-execute tool calls or re-touch the filesystem during replay, preserving zero side-effects and deterministic safety.

### 1.4 Single-Agent vs Multi-Agent Swarms

- **Design:** Phase 4 models an agent session as a primary actor (`agentName`) with coordinated human reviewers.
- **Future Work:** While the underlying EvidenceKit event schema supports multi-agent correlation IDs (`correlation_ids: [parentAgent, subAgent]`), the AgentLedger UI is currently optimized for single agent streams. Hierarchical multi-agent tree visualization is planned for future phases.

### 1.5 Database Connection Resilience

- **Design:** The application gracefully falls back to high-speed in-memory hash-chaining if PostgreSQL is unavailable during demo sandbox mode.
- **Production Note:** For compliance audits requiring permanent retention, PostgreSQL must be running and accessible via `DATABASE_URL`.
