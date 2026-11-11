# EvidenceKit Kiroween 2026 Hackathon Competitiveness & Differentiation Review

**Target Event:** Kiroween 2026  
**Target Category:** **Skeleton Crew** ($5,000 Category Prize + Overall Pool)  
**Evaluator:** Hackathon Technical Evaluator & Product Strategy Lead  
**Audit Date:** 2026-11-11

---

## 1. Hackathon Rules & Criteria Verification

Using verified Devpost and official Kiroween 2026 documentation:

### 1.1 Submission Deadline

- **Official Deadline:** **Friday, December 4, 2026, at 2:00 PM Pacific Time (PST)** (Saturday, December 5, 2026, at 3:30 AM IST).
- **Project Window:** Projects must be newly developed during the official hackathon window (starting October 30, 2026). Pre-existing closed projects are disqualified.

### 1.2 "Skeleton Crew" Category Requirements

1. **Core Concept:** Build a clean, modular, and adaptable **skeleton code template** (a reusable foundational engine).
2. **Two Distinct Applications:** Entrants must demonstrate the template's versatility by building **two distinct applications** branching out from that single foundational code base.
3. **Repository Structure:** The repository must contain **two separate application folders** dedicated to the two separate applications built off your template (`apps/tracevault` and `apps/agentledger`).
4. **Kiro Usage Evidence:** Must show genuine, meaningful usage of Kiro development features (e.g. `.kiro/specs/`, `.kiro/steering/`, `.kiro/hooks/`, or MCP).

---

## 2. Product Positioning & Honest Claims Audit

### 2.1 The Central Pitch

> _"EvidenceKit provides trustworthy, explainable, and verifiable evidence for AI-agent activity and incident investigation."_

### 2.2 Truth in Advertising Audit

| Marketing / Spec Claim                   | Audited Reality                                             | Truthfulness Verdict | Remediation for Judging                                                                             |
| :--------------------------------------- | :---------------------------------------------------------- | :------------------- | :-------------------------------------------------------------------------------------------------- |
| **"Tamper-Evident Hash Chain"**          | RFC 8785 canonicalization + SHA-256 linking                 | **100% TRUE**        | Showcase live chain break when a byte is altered in a JSONL file.                                   |
| **"Independent Offline Verification"**   | Currently issues `fetch("/api/.../verify")`                 | **FALSE TODAY**      | Must implement genuine in-browser Web Crypto verification before judging.                           |
| **"Two Distinct Applications"**          | TraceVault (Incidents) vs AgentLedger (Agents)              | **100% TRUE**        | Clearly demonstrate the different user personas, source inputs, and workflows.                      |
| **"Legally Defensible Signed Receipts"** | Ed25519 signatures, but verifier trusts embedded keys       | **OVERSTATED**       | Reframe as "cryptographically verifiable manifests with key fingerprinting"; fix key trust pinning. |
| **"Scientific Non-Causal Disclaimers"**  | Explicit distinction between provenance and candidate links | **EXCELLENT**        | Judges will love the scientific honesty: correlation is not causation.                              |
| **"Zero-Mutation Governance"**           | Denied approvals guarantee 0 filesystem writes              | **100% TRUE**        | Showcase in demo: denied malicious tool produces zero disk side-effects.                            |

---

## 3. Evaluation of 6 High-Value Demo Scenarios

We critically evaluated 6 proposed demonstration opportunities for judge impact:

### Scenario 1: Guided Investigation Mode (Synthetic Reproducible Data)

- **Description**: A single-click button that loads a realistic, pre-packaged microservices outage incident with CI logs, deployment diffs, and database errors.
- **User Value**: High.
- **Hackathon Impact**: **Massive**. Judges typically spend 2–3 minutes evaluating a project. They do not want to configure a GitHub webhook or manually upload 10 files. A polished guided demo gives them instant value.
- **Implementation Complexity**: Low.
- **Recommendation**: **MUST IMPLEMENT**.

### Scenario 2: Suspicious Agent Action & Zero-Mutation Block

- **Description**: An autonomous AI agent attempts to read `.env` secrets and modify `protected-config.ts`. The Policy Engine blocks the secret read (`DENY`) and intercepts the config write (`REQUIRE_APPROVAL`). The human reviewer clicks "Deny", and the filesystem state confirms zero mutation.
- **User Value**: Very High.
- **Hackathon Impact**: **Massive**. Speaks directly to current enterprise anxieties regarding autonomous LLM agent safety.
- **Implementation Complexity**: Low (already 85% built in `demo/run`).
- **Recommendation**: **MUST IMPLEMENT**.

### Scenario 3: Multi-Source Evidence Ingestion with Provenance

- **Description**: Demonstrates TraceVault ingesting a GitHub commit, a CircleCI build failure, and a Kubernetes pod log, cleanly normalizing them into chronological sequence with direct links back to original line numbers.
- **User Value**: High.
- **Hackathon Impact**: High (proves the "reusable engine" narrative).
- **Implementation Complexity**: Low.
- **Recommendation**: **MUST IMPLEMENT**.

### Scenario 4: Tampered Evidence Detection Demonstration

- **Description**: Provide a pre-packaged "Tampered Evidence Bundle" where an attacker modified one log event. The user drops it into the Offline Verifier. The UI highlights the exact event sequence where the SHA-256 hash chain severed.
- **User Value**: Exceptional.
- **Hackathon Impact**: **Massive**. Visual proof of tamper detection is the single most convincing moment in a security hackathon demo.
- **Implementation Complexity**: Very Low (already supported by core engine).
- **Recommendation**: **MUST IMPLEMENT**.

### Scenario 5: Cross-Application Continuity Bridge

- **Description**: An incident case in TraceVault links directly to the AgentLedger session that caused it, allowing a reviewer to jump between the incident investigation and the autonomous agent's tool replay.
- **User Value**: High.
- **Hackathon Impact**: High (demonstrates the unifying power of the Evidence Graph).
- **Implementation Complexity**: Medium.
- **Recommendation**: **IMPLEMENT**.

### Scenario 6: Evidence Trust & Cryptographic Explainer

- **Description**: Interactive modal explaining the math behind the hash chain (RFC 8785 canonicalization, previous hash pointer, and Ed25519 signing) with KaTeX math rendering.
- **User Value**: Medium.
- **Hackathon Impact**: High for technical evaluators.
- **Implementation Complexity**: Low.
- **Recommendation**: **IMPLEMENT**.

---

## 4. What to Reject (Anti-Bloat Directive)

To win the **Skeleton Crew** category, EvidenceKit must remain focused, lean, and reliable:

- **REJECT**: Adding a conversational AI chatbot or LLM assistant inside TraceVault. It distracts from the core forensic integrity message.
- **REJECT**: Full OpenTelemetry Collector / OTLP daemon integration (too much infrastructure complexity).
- **REJECT**: Complex enterprise multi-tenant billing, team RBAC, or SSO.
- **REJECT**: Decorative animated charts that display fake, non-cryptographic telemetry.
- **REJECT**: Heavy external graph visualization libraries that balloon bundle size; build a clean, bespoke SVG node-link graph with zero external dependencies.
