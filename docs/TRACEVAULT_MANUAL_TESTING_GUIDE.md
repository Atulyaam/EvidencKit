# TraceVault — Manual Testing & Evaluation Guide

## For Kiroween 2026 Hackathon Judges & Evaluators

**Application:** TraceVault (`apps/tracevault`)  
**URL:** `http://localhost:3001`  
**Powered By:** EvidenceKit Core Engine

---

## 1. Quick Start / Running the App

### Option A: Standard Dev Server

```bash
pnpm --filter tracevault dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Option B: Production Build

```bash
pnpm --filter tracevault build
pnpm --filter tracevault start
```

---

## 2. Interactive Evaluation Walkthrough

Follow this 5-minute walkthrough to test all features of TraceVault with real incident data:

### Step 1: Create an Incident

1. Navigate to [http://localhost:3001](http://localhost:3001).
2. Click **"+ Create Incident"** or navigate to `/incidents/new`.
3. Enter:
   - **Title:** `Production Payment Gateway 502 Spike`
   - **Description:** `Cascade of timeouts following payment service deployment`
   - **Severity:** `Critical`
   - **Environment:** `production`
4. Click **"Create Incident"**. You are redirected to `/incidents/[id]`.

### Step 2: Upload Evidence Sources

1. Click the **"Evidence & Sources"** tab in the incident sub-header.
2. In the upload area, click **"Choose File"** and upload one of our sample fixtures located at:
   `fixtures/tracevault/sample-incident/application-events.jsonl`
3. Notice the **Pre-Ingestion Validation Preview**:
   - Detected Adapter: `jsonl-log`
   - Valid Events: `5 Valid`
   - Sample normalized event preview rendered in JSON
4. Click **"Confirm & Ingest 5 Events"**.
   - Notice the green confirmation message with the updated SHA-256 chain head hash.
5. Upload additional fixtures if desired:
   - `fixtures/tracevault/sample-incident/git-history.json`
   - `fixtures/tracevault/sample-incident/deployments.json`

### Step 3: Explore the Forensic Timeline

1. Click the **"Forensic Timeline"** tab.
2. View the chronological event stream.
3. Test filters:
   - Select Severity: `Critical` -> list filters instantly.
   - Enter Search: `timeout` -> matches only events mentioning timeout.
4. Click any event row on the left to open the **Provenance & Hash Inspector** drawer on the right:
   - Observe the **Hash-Chain Verification**: sequence number, previous hash, and SHA-256 event hash.
   - Observe **Source Provenance**: system name, adapter version, and exact locator (e.g., line number).
   - Observe **Pre-Persistence Secret Redaction**: In the attributes, notice authorization tokens show `[REDACTED_AUTH_TOKEN]`.

### Step 4: Discovered Candidate Correlations

1. Click the **"Overview"** tab.
2. Under **"Discovered Candidate Correlations"**, observe detected patterns:
   - E.g. `[TV-COR-004] Shared Correlation or Trace Identifier (Confidence: HIGH)`
   - Note the ethical disclaimer badge stating that correlations are candidate indicators and do not assume automated proof of root cause.

### Step 5: Generate & Export Investigation Report

1. Click the **"Investigation Report"** tab.
2. View the deterministic 12-section incident reconstruction report.
3. Toggle between **"Formatted View"** and **"Markdown Source"**.
4. Click **"Download .md"** or **"Download .json"** to export the report.

### Step 6: Export Evidence Bundle

1. Click the **"Settings & Export"** tab.
2. Under **"Export Portable Evidence Bundle"**, click:
   - **"Export JSON Bundle (.json)"** to download the standalone bundle.
   - **"Export ZIP Archive (.zip)"** to download the archive containing `manifest.json`, `events.jsonl`, `verification_report.json`, and `README.txt`.

### Step 7: Independent Cryptographic Verification & Tamper Detection

1. Click **"Verify Bundle"** in the top navigation bar (or navigate to `/verify`).
2. Upload the exported bundle or fixture:
   - **Valid Bundle:** Upload `fixtures/tracevault/sample-incident` or your exported bundle. Observe green **"Cryptographic Verification Passed"** with 100% hash continuity.
   - **Tampered Bundle:** Upload `fixtures/tracevault/tampered-bundle/bundle.json`. Observe red alert: **"Integrity Verification Failed / Tampering Detected"** with the exact broken sequence number identified!
