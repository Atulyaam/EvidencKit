# EvidenceKit — Phase 3 Implementation Plan

## TraceVault: Software Incident Evidence Reconstruction

**Author:** Principal Software Architect & Senior Full-Stack Engineer  
**Date:** 2026-11-05  
**Target:** Complete Phase 3 without modifying Phase 4 (AgentLedger)

---

## 1. Application Audit Summary

The repository provides a verified Phase 0, 1, and 2 foundation:

- `@evidencekit/core`: RFC 8785 JCS, SHA-256 hash chaining, Zod canonical schemas, secret redactor, timeline dual-ordering, portable export schemas.
- `@evidencekit/db`: 10 relational tables, Drizzle ORM models, migration pipeline.
- `@evidencekit/adapters`: Parsers for CI logs, Git history, Deployments, and Application logs.
- `@evidencekit/evidence-server`: Transactional chain append, chain verification, authorization, environment, logging.
- `@evidencekit/ui`: High-contrast dark-neutral primitives and components.
- `apps/tracevault`: Clean Next.js 14 App Router application shell.

### Incomplete Functionality Identified for TraceVault:

1. **Incident Data Model:** The `cases` table lacks `description`, `severity`, and `updated_at`.
2. **Incident CRUD Services & APIs:** Need full incident lifecycle (create, list, get, update, delete, search, filter, paginate) with workspace isolation.
3. **Evidence Upload System:** Need multi-format parser supporting JSONL, Git JSON, CI JSON, Deployment JSON, and ZIP incident bundles, with strict path traversal (zip-slip) and zip-bomb resource limit protection.
4. **Adapter Integration & Provenance Locators:** Need real file ingestion transforming raw artifacts into canonical `EvidenceEvent` envelopes with line number, record number, and json pointer locators.
5. **Deterministic Correlation Engine:** Need explainable rules (TV-COR-001..005) linking deployments, commits, CI failures, repeated errors, and temporal proximity.
6. **Deterministic Incident Report Generator:** 12-section reproducible report with markdown and JSON export.
7. **TraceVault Routes & Screens:**
   - `/` (Forensic Investigation Home / Incident Dashboard)
   - `/incidents` (Incident Case Directory)
   - `/incidents/new` (New Incident Case Creation)
   - `/incidents/[id]` (Incident Overview & Quick Actions)
   - `/incidents/[id]/evidence` (Evidence Upload & Source Preview)
   - `/incidents/[id]/timeline` (Interactive Forensic Timeline & Event Drawer)
   - `/incidents/[id]/correlations` (Candidate Correlation Discovery)
   - `/incidents/[id]/report` (Investigation Report Viewer & Exporter)
   - `/incidents/[id]/settings` (Incident Case Settings & Export Bundle)
8. **Test Fixtures:** `fixtures/tracevault/` containing valid multi-source incident bundles, corrupt archives, and tampered bundles.
9. **Full Testing Suite:** Unit, integration, property-based, security, performance, and Playwright E2E tests.

---

## 2. Technical Execution Steps

### Step 1: Database Schema Extension & Migrations

- Add `description`, `severity`, and `updated_at` to `cases` in `packages/db/src/schema/index.ts`.
- Run `pnpm db:generate`.

### Step 2: Incident Management Service (`packages/evidence-server/src/services/incident-service.ts`)

- Implement `createIncident`, `getIncident`, `listIncidents`, `updateIncident`, `deleteIncident`.
- Zod schema validation: `CreateIncidentSchema`, `UpdateIncidentSchema`, `IncidentQuerySchema`.
- Workspace scoping & ownership check.
- In-memory support for fast tests/demo mode + PostgreSQL Drizzle transactions.

### Step 3: Evidence Upload & Archive Processing Service (`packages/evidence-server/src/services/evidence-upload-service.ts`)

- File format sniffers: JSONL logs, Git JSON, CI JSON, Deployment JSON, EvidenceKit JSON, ZIP.
- Security guards:
  - Max compressed size: 20 MB (`MAX_UPLOAD_COMPRESSED_BYTES`).
  - Max decompressed size: 100 MB (`MAX_UPLOAD_EXPANDED_BYTES`).
  - Max archive entries: 200 entries (`MAX_ARCHIVE_ENTRIES`).
  - Strict path traversal prevention: reject absolute paths, `..`, colons/drive letters.
- Preview mode: parse without saving to return record counts, source types, and validation warnings.
- Import execution: transform via `@evidencekit/adapters`, redact secrets via `@evidencekit/core`, append to chain transactionally via `@evidencekit/evidence-server`.

### Step 4: Candidate Correlation Engine (`packages/evidence-core/src/correlation/index.ts`)

- Deterministic rules:
  - `TV-COR-001`: Deployment failure followed by application error (shared environment/service within window).
  - `TV-COR-002`: CI workflow failure sharing commit SHA with Git commit.
  - `TV-COR-003`: Migration event followed by DB error within time window.
  - `TV-COR-004`: Repeated errors sharing correlation ID / trace ID.
  - `TV-COR-005`: Temporal proximity clustering of critical/error events.
- Structured output: rule ID, explanation, matching signals, related event IDs, confidence score, time delta.

### Step 5: Deterministic Investigation Report Generator (`packages/evidence-server/src/services/report-service.ts`)

- 12 standard sections: summary, metadata, evidence sources, event counts, timeline highlights, git activity, CI activity, deployment activity, candidate correlations, integrity status, limitations, source references.
- Export to Markdown, JSON, and print-ready HTML view.

### Step 6: Portable Export & Import Integration

- Export stream as verifiable `evidencekit-export.zip` containing `manifest.json`, `events.jsonl`, `evidence-refs.json`, and `chain-verification.json`.
- In-app verification of uploaded export bundles, rejecting any altered hashes or modified events.

### Step 7: TraceVault API Routes & Complete Interactive UI

- Create API endpoints:
  - `/api/incidents` (GET, POST)
  - `/api/incidents/[id]` (GET, PATCH, DELETE)
  - `/api/incidents/[id]/evidence` (POST upload/import, GET artifacts)
  - `/api/incidents/[id]/timeline` (GET paginated events with filters)
  - `/api/incidents/[id]/correlations` (GET candidate relationships)
  - `/api/incidents/[id]/report` (GET report in JSON or Markdown)
  - `/api/incidents/[id]/export` (GET downloadable zip/json bundle)
  - `/api/evidence/verify` (POST verify uploaded bundle)
- Build UI pages and components in `apps/tracevault`:
  - Navigation bar with Incident selector, breadcrumbs, and Judge Mode indicator.
  - Incident list with search, severity/status filters, and pagination.
  - Incident creation wizard.
  - Incident overview with metrics and integrity status.
  - Evidence upload interface with drag-and-drop, preview modal, validation warnings, and import history.
  - Forensic timeline with search, category filtering, and slide-over event inspector drawer with provenance locators.
  - Correlation discovery view showing candidate relationships.
  - Investigation report viewer with 1-click Markdown copy and download.
  - Settings page for status changes and bundle export.

### Step 8: Test Fixtures & Deterministic Demo Data

- `fixtures/tracevault/valid-incident-bundle/` (manifest, application-events.jsonl, git-history.json, ci-events.json, deployments.json).
- `fixtures/tracevault/tampered-bundle/` (tampered hash).
- `fixtures/tracevault/corrupt-zip/` & `traversal-test/`.

### Step 9: Testing & Quality Gates

- Unit tests for incident service, upload service, correlation engine, report service.
- Integration tests for end-to-end import, persistence, and verification.
- Security tests for zip-slip, zip-bomb, secret redaction, and authorization.
- Property-based tests for correlation determinism and report stability.
- Playwright E2E tests for the full user journey.
- Performance benchmarks on 1,000 and 10,000 events.
- Full quality gate: format, lint, typecheck, test, build.
