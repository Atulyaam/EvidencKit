# Evidence Quality & Completeness Engine Specification

**EvidenceKit — Forensic Stream Health, Consistency & Gap Analysis**  
**Document Version:** 1.0.0  
**Status:** Approved & Implemented  
**Date:** 2026-11-06

---

## 1. Executive Summary

Forensic incident reconstruction is only as reliable as the quality and continuity of the evidence ingested. Missing log segments, duplicate records, uncalibrated clock skew, omitted provenance headers, and excessive redactions degrade an investigator's ability to reconstruct truth.

The **Evidence Quality & Completeness Engine** is a deterministic analyzer that audits evidence streams for structural and temporal anomalies. It evaluates incoming evidence against forensic rules, computes an objective **Completeness Score (0–100%)**, quantifies multi-source coverage, and generates actionable remediation guidance.

Every quality assessment includes an immutable, prominent **Forensic Non-Causality & Truthfulness Notice**, stating clearly that structural consistency does not prove that underlying log statements are factually truthful.

---

## 2. Forensic Quality Rules & Anomaly Detection

Defined in `@evidencekit/core/src/quality/index.ts`, the engine executes 6 distinct forensic inspection checks:

| Rule Code                  | Severity   | Description                                     | Detection Logic                                                                                  | Remediation Guidance                                                               |
| -------------------------- | ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `DUPLICATE_EVENT_ID`       | `critical` | Duplicate Event Identifier Detected             | Two or more events share an identical `event_id`.                                                | Ensure ingestion pipelines generate unique UUIDv4 identifiers per event.           |
| `INVALID_TIMESTAMP`        | `critical` | Unparseable or Invalid Timestamp                | `occurred_at` or `observed_at` fails ISO 8601 parsing or represents an impossible calendar date. | Calibrate logging adapters to format UTC timestamps conforming to RFC 3339.        |
| `FUTURE_TIMESTAMP`         | `warning`  | Future Timestamp / Excessive Clock Skew         | `occurred_at` is more than 300 seconds ahead of analyzer wall-clock time.                        | Synchronize host systems with reliable NTP time servers.                           |
| `OBSERVED_BEFORE_OCCURRED` | `warning`  | Time Inversion: Observation Precedes Occurrence | `observed_at < occurred_at` by more than 1,000ms.                                                | Check system clock synchronization between collector and source servers.           |
| `MISSING_PROVENANCE`       | `warning`  | Missing Source Provenance Metadata              | Event lacks `source.system`, `source.adapter`, or `source.adapter_version`.                      | Update log forwarding pipelines to attach full origin provenance headers.          |
| `SENSITIVE_REDACTION`      | `info`     | High Volume of Redacted Fields                  | Redactions exceed 10% of total stream events.                                                    | Review redaction regex rules to ensure necessary operational context is preserved. |

---

## 3. Completeness Score Algorithm

The **Completeness Score** is a deterministic metric on a scale of 0 to 100:

$$\text{Completeness Score} = \max\left(0, 100 - \sum \text{Penalties}\right)$$

### Penalty Deductions:

- **Critical Issues** (`DUPLICATE_EVENT_ID`, `INVALID_TIMESTAMP`): **-25 points** each.
- **Warning Issues** (`FUTURE_TIMESTAMP`, `OBSERVED_BEFORE_OCCURRED`, `MISSING_PROVENANCE`): **-10 points** each.
- **Informational Issues** (`SENSITIVE_REDACTION`): **-2 points** each.

A stream with zero defects achieves a **100% Completeness Score**, indicating pristine cryptographic sequence, consistent timestamps, and complete origin provenance.

---

## 4. Multi-Source Coverage Assessment

To prevent reliance on a single siloed log source, the engine evaluates source diversity:

- Groups events by `event.source.system` (e.g. `github`, `datadog`, `kubernetes`, `aws-cloudwatch`).
- Computes absolute event counts and relative percentage breakdown.
- Visualizes source distribution in the TraceVault Quality Audit UI, highlighting single points of failure in telemetry collection.

---

## 5. Mandatory Forensic Disclaimer

In accordance with EvidenceKit's forensic honesty principles, every quality report mandates the following disclaimer:

> **CRITICAL FORENSIC NOTICE: Completeness Assessment vs. Truthfulness**  
> This forensic quality analysis assesses structural completeness, metadata consistency, and cryptographic sequence integrity across evidence logs. It does NOT claim that the underlying source evidence is truthful, nor does it prove causal relationships between correlated events.

---

## 6. API & User Interface

- **API Endpoint**: `GET /api/incidents/[id]/quality`
  - Returns `EvidenceQualityReport` JSON payload.
  - Supports query parameter `?format=markdown` to generate exportable Markdown forensic audit summaries.
- **TraceVault Quality Audit Page**: `/incidents/[id]/quality`
  - **Score Gauge**: Visual circular gauge displaying Completeness Score with semantic color coding (Emerald $\ge 80$, Amber $50-79$, Red $< 50$).
  - **Metric Summary Cards**: Total Events Analyzed, Source Systems Count, Redacted Tokens, Detected Issues.
  - **Issue Diagnostic Table**: Detailed breakdown of each flagged issue, severity badge, rule code, affected event IDs, and suggested remediation steps.
  - **Markdown Export**: Direct button to download formatted forensic audit reports for regulatory compliance.
