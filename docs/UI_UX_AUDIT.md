# EvidenceKit Comprehensive UI/UX and Visual Design Audit

**Project:** EvidenceKit (TraceVault & AgentLedger)  
**Lead Evaluator:** Senior Product Designer & UI/UX Researcher  
**Audit Date:** 2026-11-11  
**Scope:** Complete frontend inspection across all routes, layouts, and components  

---

## 1. Executive Summary & Design Critique

The current user interface across both TraceVault and AgentLedger exhibits the classic symptoms of rapid, AI-generated frontend development:
1. **Generic AI Dashboard Aesthetic**: Repetitive 3-card metric counters, generic dark background gradients (`bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950`), repetitive pulsing green dots for "Public Judge Mode", and cookie-cutter tables.
2. **Iconography Disconnect**: TraceVault uses raw Unicode emojis (`📁`, `📥`, `📄`, `🛡️`, `🔍`, `🔐`), whereas AgentLedger uses `lucide-react`. The two applications look like they were built by two completely different teams with different styling conventions.
3. **Monolithic Architecture**: Neither application has a `components/` directory. All layout, state, API calls, and styling are crammed into monolithic 200–400 line `page.tsx` files.
4. **Deceptive Graph Representation**: The "Evidence Graph" in both apps is not an interactive node-link graph; it is a 2-column CSS card list with a side panel listing text connections.
5. **Lack of Forensic Gravitas**: A digital evidence and forensic audit platform should feel precise, authoritative, dense, and cryptographically defensible—reminiscent of high-end forensic workstations, Linear, or Palantir Foundry—rather than a generic SaaS template.

---

## 2. Complete Route Inventory & Assessment

### 2.1 TraceVault (`apps/tracevault`)

| Route Path | Purpose | Main Action | Current Components | Functional Status | Responsive Behavior | UX & Accessibility Issues |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Landing & Incident Dashboard | View metrics; create incident | Monolithic `page.tsx`, Cards, Badges | Functional | Good (Grid collapses) | Generic 3-card stats; emoji in banner; no skeleton loading |
| `/incidents` | Incident List | Search & filter incident cases | Monolithic `page.tsx`, Table, Badges | Functional | Moderate (Horizontal scroll on table) | No debounced search; basic text filtering; table wraps awkwardly |
| `/incidents/new` | New Incident Form | Create case with title/severity | Form inputs, select menus | Functional | Good | Minimal form validation feedback; plain text fields |
| `/incidents/[id]` | Incident Case Overview | View case status & navigation tabs | Navigation pill links, stat cards | Functional | Good | Redundant tabs; repetitive metadata display |
| `/incidents/[id]/evidence` | Evidence Artifact Ingestion | Drag-and-drop log upload | Dropzone box, artifact list | Functional | Good | Emoji block `📁`; crude file size rendering; no upload progress bar |
| `/incidents/[id]/timeline` | Forensic Hash-Chain Timeline | Inspect events & chain hashes | `packages/ui` Timeline component | Functional | Moderate | No virtualization; long streams (>500 items) lag DOM |
| `/incidents/[id]/quality` | Forensic Quality Analysis | View completeness score (0-100) | Progress bar, issue list | Functional | Good | Score calculation is arbitrary absolute penalty; no metric drilldown |
| `/incidents/[id]/report` | Post-Incident Summary | Export summary report | Markdown preview card | Functional | Good | Static text generation; missing interactive chart/graph export |
| `/incidents/[id]/settings` | Incident Settings | Edit case status/environment | Form inputs, Delete button | Functional | Good | Destructive delete lacks double-confirmation modal |
| `/graph` | Unified Multi-Stream Graph | Explore evidence topology | 2-column card grid, side drawer | Functional | Poor on mobile | **Not a real graph**; card list masquerading as graph explorer |
| `/verify` | Independent Bundle Verifier | Upload bundle and verify hash chain | Dropzone box, status badges | Functional | Good | Claims offline verification but executes network `fetch()` |

### 2.2 AgentLedger (`apps/agentledger`)

| Route Path | Purpose | Main Action | Current Components | Functional Status | Responsive Behavior | UX & Accessibility Issues |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | AI Agent Audit Dashboard | Launch demo; view sessions | Monolithic `page.tsx`, Lucide icons | Functional | Good | Repetitive hero banner; identical 3-card stats layout |
| `/sessions` | Session List | Filter agent sessions | Table, status badges | Functional | Moderate | Table layout identical to TraceVault |
| `/sessions/new` | New Session Wizard | Configure agent name & goal | Multi-step form cards | Functional | Good | Clean, but lacks preset scenario templates |
| `/sessions/[id]` | Session Detail Overview | View session status & tabs | Tab bar, metadata cards | Functional | Good | Too many navigation tabs; cluttered layout |
| `/sessions/[id]/timeline` | Agent Action Timeline | View tool calls & approvals | Custom timeline widget | Functional | Moderate | Missing visual distinction between tool start vs complete |
| `/sessions/[id]/approvals` | Human-in-the-Loop Approvals | Approve or deny tool requests | Approval cards, Action buttons | Functional | Good | Zero-mutation messaging could be highlighted more prominently |
| `/sessions/[id]/files` | Sandbox File Browser & Diffs | Inspect file changes & diffs | File tree, diff view | Functional | Moderate | Diff viewer is plain text lines; lacks side-by-side syntax diff |
| `/sessions/[id]/replay` | Time-Travel Forensic Replay | Step backward/forward in time | Step slider, state viewer | Functional | Good | One of the strongest features; needs cleaner scrub bar UX |
| `/sessions/[id]/export` | Signed Export Ledger | Download signed JSON / ZIP | Export cards, key info | Functional | Good | Clear cryptographic metadata display |
| `/policies` | Policy Engine & Live Simulator| Test policy against hypothetical tools| Rule list, live simulation form | Functional | Good | Very high product value; needs interactive rule builder |
| `/graph` | Unified Multi-Stream Graph | Explore cross-app evidence graph | 2-column card grid (duplicate) | Functional | Poor on mobile | **95% identical copy-paste of TraceVault graph page** |
| `/verify` | Bundle Verifier | Verify agent ledger bundle | JSON textarea, verify button | Functional | Good | Claims offline verification but executes network `fetch()` |

---

## 3. Visual Audit: Detailed Critiques

### 3.1 Visual Hierarchy & Information Density
- **Defect**: The current interface wastes excessive vertical space on decorative gradient hero banners (`p-8`, `max-w-2xl`). Forensic investigators need immediate, dense data visibility: active incidents, critical unapproved actions, recent chain hashes, and anomaly indicators.
- **Remediation**: Transition to an enterprise header with breadcrumbs, streamlined status pills, and dense, filterable data tables.

### 3.2 Typography & Cryptographic Readability
- **Defect**: SHA-256 hashes (`event_hash`, `previous_hash`, `manifest_hash`) and Ed25519 public key fingerprints are rendered in generic fonts or plain `font-mono` without truncation helpers, copy buttons, or visual chunking.
- **Remediation**:
  - Adopt **JetBrains Mono** or **Geist Mono** for all technical metadata, timestamps, and hashes.
  - Implement a dedicated `<HashPill />` component that renders truncated hashes (`a1b2...c3d4`) with full hover tooltip and one-click copy feedback.
  - Use KaTeX math rendering where formal hash-chain formulas are presented:
    $$\text{hash}_n = \text{SHA-256}(\text{JCS}(\text{event}_n) \parallel \text{hash}_{n-1})$$

### 3.3 Color Palette & Semantic System
- **Current Issue**: TraceVault is arbitrarily blue (`bg-blue-600`), and AgentLedger is arbitrarily purple (`bg-purple-500`). The colors feel decorative rather than semantic.
- **Recommended Palette**:
  - Background: Deep slate/zinc `#090D16` / `#0E131F`.
  - Border: Restrained slate `#1E293B`.
  - Forensic Accent: Deep Teal `#0D9488` / Emerald `#10B981` (for cryptographic integrity).
  - High-Risk / Denial: Crimson `#E11D48`.
  - Approval Pending: Amber `#F59E0B`.
  - Text: Primary `#F8FAFC`, Secondary `#94A3B8`, Muted `#64748B`.

### 3.4 Iconography System Evaluation

The existing codebase mixes raw Unicode emojis in TraceVault with `lucide-react` in AgentLedger. We evaluated 3 professional icon packages to establish a single, unified standard:

| Icon System | Consistency & Stroke Weight | Forensic / Security Fit | Monorepo Bundle Overhead | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Tabler Icons** | Excellent (5,000+ icons, 24px grid, configurable stroke) | Very high (rich security, devops, database, and crypto icons) | Low (`@tabler/icons-react` tree-shakes well) | **STRONG CANDIDATE** |
| **Iconoir** | Good (clean 1.5px stroke, technical aesthetic) | High (minimalist, modern) | Low | **VIABLE ALTERNATIVE** |
| **Phosphor Icons** | Excellent (6 weights: regular, bold, duotone, fill) | High (duotone weight gives distinct high-end enterprise feel) | Moderate | **STRONG CANDIDATE** |
| **Lucide Icons** | Good (clean, familiar, already partially installed) | Moderate (slightly generic SaaS look, but already in deps) | Zero added package | **RECOMMENDED BASELINE** |

**Recommendation**:
- Standardize on **Lucide Icons** (already installed in monorepo dependencies) across **both** applications to avoid installing new dependencies during Part 0.
- Completely purge all emojis (`📁`, `📥`, `📄`, `🛡️`, `🔍`, `🔐`) from TraceVault and replace with Lucide's `FolderArchive`, `FileCode`, `ShieldCheck`, `Search`, `KeyRound`, `GitBranch`.
- Configure stroke width consistently at `1.75px` across all icons.

---

## 4. Proposed Design Direction: "Forensic Investigation Studio"

### 4.1 Visual Design Tokens
```css
/* Proposed Forensic Design Tokens */
--bg-canvas: #090d16;
--bg-surface: #0f172a;
--bg-surface-elevated: #1e293b;
--border-subtle: #1e293b;
--border-strong: #334155;
--text-primary: #f8fafc;
--text-secondary: #94a3b8;
--text-muted: #64748b;

/* Semantic Verification Tokens */
--crypto-valid: #10b981;
--crypto-valid-bg: rgba(16, 185, 129, 0.1);
--crypto-tampered: #f43f5e;
--crypto-tampered-bg: rgba(244, 63, 94, 0.1);
--crypto-unverified: #f59e0b;
```

### 4.2 Shared Presentation Components Architecture
Extract duplicated code into `packages/ui/src/`:
1. `<EvidenceHeader />`: Unified application header with workspace switcher, application bridge link, and verification badge.
2. `<HashPill />`: Cryptographic hash inspector with truncation, copy button, and link to verification.
3. `<EvidenceGraphViewer />`: Genuine interactive SVG/Canvas node-link visualization replacing the 2-column card list.
4. `<TimelineStream />`: Virtualized chronological timeline with source badges and diff previews.
5. `<PolicyBadge />`: Clear semantic representation of `ALLOW` (green), `REQUIRE_APPROVAL` (amber), and `DENY` (red).
6. `<OfflineVerifierWidget />`: In-browser drag-and-drop cryptographic verifier using Web Crypto API.

---

## 5. Prioritized Redesign Sequence

### 5.1 TraceVault Redesign Priority
1. **Priority 1: `/incidents/[id]/timeline` (Evidence Timeline)**: The core product screen where judges inspect reconstructed incidents. Must feature clean event cards, provenance links, hash verification tags, and credential redaction tags.
2. **Priority 2: `/incidents/[id]/evidence` (Upload & Ingestion)**: Replace emoji dropzone with a professional forensic artifact ingestion workstation showing real-time file hashes.
3. **Priority 3: `/graph` (Evidence Graph)**: Replace the card list with an authentic interactive node-link canvas.
4. **Priority 4: `/` & `/incidents` (Overview & List)**: Replace generic gradient hero with dense, filterable incident command center.

### 5.2 AgentLedger Redesign Priority
1. **Priority 1: `/sessions/[id]/replay` (Forensic Replay & Files)**: The most impressive and distinctive feature. Upgrade scrub slider, side-by-side file diffs, and cryptographic state verification.
2. **Priority 2: `/policies` (Policy Engine & Simulator)**: Clean visual rule builder and interactive live simulation playground.
3. **Priority 3: `/sessions/[id]/approvals` (Approval Gates)**: Highlight human-in-the-loop governance and zero-mutation guarantees.
4. **Priority 4: `/sessions/[id]/timeline` (Session Timeline)**: Unify timeline components with TraceVault's design.

