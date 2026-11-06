# AgentLedger Manual QA & Testing Guide

This guide provides step-by-step instructions for judges, auditors, and evaluators to manually test and explore **AgentLedger**.

---

## 1. Prerequisites & Launching the Application

Ensure the monorepo dependencies and database migrations are ready:

```bash
# 1. Apply database migrations to PostgreSQL
pnpm db:migrate

# 2. Start the AgentLedger application (runs on port 3002)
pnpm --filter agentledger dev
# Or production build:
pnpm --filter agentledger start -p 3002
```

Open your browser to: **`http://localhost:3002`**

_(Note: TraceVault runs concurrently on `http://localhost:3001`)_

---

## 2. Interactive QA Tour

### Step 1: Landing Dashboard & Metrics (`/`)

1. Observe the top brand header with **`AgentLedger Audit Stream`** and the badge **`Owner / Auditor Mode`**.
2. Notice the 4 live KPI cards:
   - **Total Sessions**: Count of recorded agent sessions.
   - **Active Runs**: In-flight sessions awaiting or running tools.
   - **Pending Approvals**: Number of human-in-the-loop gates requiring intervention.
   - **Integrity Verified**: 100% SHA-256 chain sealed status.
3. Locate the **"Launch Controlled Demo"** hero button.

### Step 2: Running the Autonomous Demonstration Workflow

1. Click **"Launch Controlled Demo"**.
2. Observe the animated progress indicator:
   - Initializes isolated sandbox directory (`fixtures/agentledger/sandbox/<sessionId>/`).
   - Agent lists files (`list_files`).
   - Agent creates audit notes (`create_file`).
   - Agent modifies safe configuration (`modify_file` on `src/config.ts`).
   - Agent attempts unauthorized modification of protected file (`src/protected-config.ts` attempting to disable MFA).
   - Security Policy Denial gate triggers and automatically rejects the change.
   - Verifies **Zero Mutation Guarantee**: protected file bytes and SHA-256 hash remain completely untouched.
   - Seals the session hash-chain.
3. You will be automatically redirected to the **Timeline** page of the new session.

### Step 3: Exploring the Forensic Timeline (`/sessions/[id]/timeline`)

1. Observe the chronological stream of canonical events:
   - `agent.session.created` (Seq #0)
   - `agent.run.started` (Seq #1)
   - `agent.tool.started` (Seq #2)
   - `agent.tool.completed` (Seq #3)
   - `agent.approval.requested`
   - `agent.approval.decided`
   - `agent.tool.failed` (Authorization denied on malicious attempt)
   - `agent.file.changed`
   - `agent.run.completed`
2. **Click on any event card**:
   - The right-hand panel updates immediately to display the **Provenance & Hash Inspector**.
   - Notice the **RFC 8785 Sealed** badge.
   - Inspect the **Event Hash (SHA-256)** and the **Previous Link Hash**.
   - Inspect the raw JSON payload in the attributes viewer.

### Step 4: Inspecting Human Approval Gates (`/sessions/[id]/approvals`)

1. Click the **"Approvals"** tab in the sub-navigation.
2. Under **Decision History Audit Trail**, observe the recorded decisions:
   - Notice the **`rejected`** decision for `modify_file` on `src/protected-config.ts`.
   - Read the rationale: _"REJECTED: Unauthorized attempt to weaken production security policy (MFA disable forbidden)"_.
   - Notice the **`approved`** decision for `modify_file` on `src/config.ts`.

### Step 5: Inspecting Sandbox Files & Unified Diffs (`/sessions/[id]/files`)

1. Click the **"Files"** tab in the sub-navigation.
2. View the modified file (`src/config.ts`).
3. Notice:
   - Old SHA-256 vs New SHA-256 digests computed directly from disk bytes.
   - Lines added and removed counts.
   - Unified diff view with green `+` additions and red `-` removals.

### Step 6: Operating the Deterministic Forensic Replay Player (`/sessions/[id]/replay`)

1. Click the **"Replay"** tab in the sub-navigation.
2. Notice the alert: _"Deterministic Forensic Replay: Reconstructing historical states directly from the immutable EvidenceKit RFC8785 hash chain. No tools or file modifications are re-executed."_
3. Use the playback controls:
   - Click **Play** to watch the history advance automatically at 1x speed.
   - Change speed to **2x** or **0.5x**.
   - Use the **Timeline Scrubber Slider** to jump to any arbitrary step.
   - Use **Step Forward (`>`)** and **Step Backward (`<`)** buttons.
4. Watch the reconstructed snapshot cards update in real-time:
   - **Active Tool Calls** (arguments, outputs, execution duration).
   - **Human Approval Gates** (approval ID, status, rationale).
   - **Files Modified in Sandbox** (before/after hashes, diffs).

### Step 7: Exporting the Cryptographic Bundle (`/sessions/[id]/export`)

1. Click the **"Export"** tab in the sub-navigation.
2. Review the **Cryptographic Manifest** on the left:
   - Format: `evidencekit-export v1.0`
   - Stream ID, Event Count, Chain Head Hash.
3. Click **"Download Bundle JSON"** to download the signed bundle file to your machine.
4. Click **"Copy JSON"** to copy the bundle payload to your clipboard.

### Step 8: Independent Offline Bundle Verification (`/verify`)

1. Click **"Verify Bundle"** in the top navigation header.
2. Upload the downloaded bundle JSON file or paste the clipboard JSON into the raw content box.
3. Click **"Verify Bundle Integrity"**.
4. Observe the green confirmation banner:
   - _"VERIFIED: All events verified. Head hash matched."_
5. **Tamper Test**:
   - In the JSON text area, modify any character (e.g., change an event attribute or timestamp).
   - Click **"Verify Bundle Integrity"** again.
   - Observe the immediate red rejection banner:
     - _"FAILED: Event hash mismatch at sequence X"_ or _"Chain head hash mismatch"_.

---

## 3. Creating a Custom Session via Wizard (`/sessions/new`)

1. Click **"New Session"** in the header.
2. Choose a workflow preset:
   - Click **"Auth Refactoring Agent"** or **"Security Policy Auditor"** to auto-populate fields.
3. Or manually type a custom agent name and goal.
4. Click **"Create Audit Session"**.
5. The session is created in PostgreSQL and initialized with `agent.session.created` on the hash-chain.
