# EvidenceKit Database & Deployment Readiness Audit

**Project:** EvidenceKit (TraceVault & AgentLedger)  
**Lead DevOps & Reliability Engineer:** Senior Production Reliability Specialist  
**Audit Date:** 2026-11-11  

---

## 1. Executive Deployment Verdict: **NOT READY FOR PRODUCTION**

While the production Next.js builds (`pnpm build`) succeed cleanly and package outputs compile without TypeScript errors, the system is **NOT currently deployed to a public environment** and contains several blocking operational defects that would crash in standard cloud hosting environments:

1. **Hardcoded Private IP in Configuration**: `.env` specifies `DATABASE_URL=postgresql://postgres:postgres@172.31.88.58:5432/evidencekit`. This is a non-routable internal WSL2/Hyper-V network IP that fails immediately on cloud hosts.
2. **Missing Database Policies Table**: The AgentLedger Policy Engine stores policies strictly in process memory; any container restart or serverless cold start purges custom policy configurations.
3. **No S3 / Cloud Storage Implementation**: File artifact uploads (`evidence_artifacts`) are written to local disk or memory; `S3_ENDPOINT` and `S3_ACCESS_KEY_ID` are defined in `env.ts` but the actual S3 client adapter is stubbed out.
4. **No Public HTTPS Domain**: Both applications are configured with hardcoded local origins: `NEXT_PUBLIC_TRACEVAULT_URL=http://localhost:3001` and `NEXT_PUBLIC_AGENTLEDGER_URL=http://localhost:3002`.
5. **No Production Key Injection**: The server creates a random ephemeral Ed25519 signing key pair on each restart because `EVIDENCE_SIGNING_PRIVATE_KEY` is not wired to persistence.

---

## 2. Current State vs. Production Readiness Matrix

| Infrastructure Dimension | Current Status | Local Readiness | Production Readiness | Blocker / Remediation Required |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Hosting** | Next.js 14 Standalone | **READY** (Builds clean) | **BLOCKED** | Needs deployment to Vercel / Railway / Fly.io |
| **Backend API Routing** | Next.js Route Handlers | **READY** | **READY** | Same process as frontend |
| **Database Provider** | PostgreSQL (Drizzle ORM) | **BLOCKED** (Host down) | **BLOCKED** | Requires hosted Postgres (Neon / Supabase / Railway) |
| **Database Migrations** | 3 Drizzle SQL migrations | **READY** (`0000`–`0002`) | **BLOCKED** | Missing migration for `policies` table |
| **Persistence Survival** | In-memory fallback Map | **PARTIAL** | **UNSUITABLE** | Restarts wipe in-memory incident/session state |
| **Storage / Blobs** | Local filesystem | **READY** (`fixtures/sandbox`)| **BLOCKED** | Artifact uploads require S3 / Cloudflare R2 |
| **Health Checks** | `/api/health` implemented | **READY** (Returns 200) | **READY** | Verified on both ports 3001 and 3002 |
| **Logging & Telemetry** | `console.log` / `console.warn`| **READY** | **NEEDS WORK** | Structured JSON logging needed for cloud |
| **Secrets Management** | Plaintext `.env` file | **DEVELOPMENT ONLY** | **BLOCKED** | Must move secrets to Cloud Environment Variables |
| **CORS Configuration** | Implicit Next.js same-origin | **READY** | **NEEDS WORK** | Cross-app links (`3001` -> `3002`) need CORS headers |

---

## 3. Database Schema & Migration Inspection

### 3.1 Existing Migrations
Located in `packages/db/migrations/`:
- `0000_old_barracuda.sql`: Creates `workspaces`, `users`, `cases`, `events`, `chain_heads`, `event_evidence_refs`, `exports`.
- `0001_bored_shape.sql`: Creates `agent_sessions`, `agent_approvals`.
- `0002_rainy_valeria_richards.sql`: Adds metadata column and indexes on severity/status.

### 3.2 Schema Deficiencies
- **Missing `policies` table**:
  Currently, policies exist only as TypeScript interfaces in `packages/evidence-core/src/policy/index.ts` and in-memory arrays in `packages/evidence-server/src/services/agent-policy-service.ts`.
  **Required Drizzle Schema**:
  ```typescript
  export const policies = pgTable("policies", {
    id: varchar("id", { length: 128 }).primaryKey(),
    version: varchar("version", { length: 64 }).notNull(),
    workspaceId: varchar("workspace_id", { length: 128 })
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    description: text("description"),
    defaultDecision: varchar("default_decision", { length: 64 }).notNull().default("REQUIRE_APPROVAL"),
    rulesJson: jsonb("rules_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  });
  ```

---

## 4. Environment Variables Audit

| Variable Name | Present in `.env` | Expected Format | Sensitive? | Purpose & Audit Observation |
| :--- | :--- | :--- | :--- | :--- |
| `AUTH_SECRET` | Yes | 32+ char string | **YES** | Currently default dummy secret. Must be generated securely for production. |
| `AUTH_GITHUB_ID` | Empty | String | No | Defined in schema but unused in authentication logic. |
| `AUTH_GITHUB_SECRET`| Empty | Secret string | **YES** | Defined in schema but unused in authentication logic. |
| `OWNER_GITHUB_ID` | `local-dev-owner` | String | No | Target identifier for owner role. Used in auth bypass! |
| `NEXT_PUBLIC_TRACEVAULT_URL` | `http://localhost:3001` | URL | No | Hardcoded local origin. Needs production URL. |
| `NEXT_PUBLIC_AGENTLEDGER_URL`| `http://localhost:3002` | URL | No | Hardcoded local origin. Needs production URL. |
| `DATABASE_URL` | `postgresql://...172.31.88.58...` | Postgres URI | **YES** | Unreachable WSL2 IP. Causes 5000ms timeout locks! |
| `MAX_UPLOAD_COMPRESSED_BYTES` | `20971520` (20 MB) | Number | No | Reasonable upload constraint. |
| `MAX_UPLOAD_EXPANDED_BYTES` | `104857600` (100 MB)| Number | No | Protects against zip bombs. |
| `MAX_ARCHIVE_ENTRIES` | `200` | Number | No | Reasonable archive entry cap. |
| `MAX_EVENT_PAYLOAD_BYTES` | `65536` (64 KB) | Number | No | Enforces reasonable event sizes. |
| `DEMO_MODE` | `true` | Boolean string | No | Sets read-only judge role for unauthenticated requests. |
| `EVIDENCE_SIGNING_PRIVATE_KEY`| **MISSING** | Base64 PKCS8 | **CRITICAL**| Not present! Causes ephemeral key generation on every restart. |
| `EVIDENCE_SIGNING_KEY_ID` | **MISSING** | String | No | Not present. |
| `EVIDENCE_VERIFY_PUBLIC_KEY` | **MISSING** | Base64 SPKI | No | Not present. |

---

## 5. Recommended Production Deployment Blueprint

To maintain simplicity, reliability, and cost-effectiveness for the Kiroween 2026 hackathon demonstration, the following architecture is recommended:

```mermaid
graph TD
    subgraph PublicInternet["Public Internet / Judge Access"]
        USER["Hackathon Judges & Public Reviewers"]
    end

    subgraph EdgeRouting["Edge & Hosting Layer (Vercel or Railway)"]
        TV_EDGE["TraceVault Web App<br/>(tracevault.evidencekit.dev)"]
        AL_EDGE["AgentLedger Web App<br/>(agentledger.evidencekit.dev)"]
    end

    subgraph DataLayer["Cloud Persistence Layer"]
        NEON["Serverless PostgreSQL (Neon / Supabase)<br/>- Automated Connection Pooling (PgBouncer)<br/>- Fast 10ms Cold Starts<br/>- Automated Backups"]
        R2["Cloudflare R2 / AWS S3<br/>- Encrypted Artifact Storage<br/>- Zero Egress Fees"]
    end

    USER -->|HTTPS| TV_EDGE
    USER -->|HTTPS| AL_EDGE
    TV_EDGE -->|Drizzle ORM over Pooled Connection| NEON
    AL_EDGE -->|Drizzle ORM over Pooled Connection| NEON
    TV_EDGE -->|Presigned URL Uploads| R2
    AL_EDGE -->|Diff Snapshots| R2
```

### Key Advantages of This Stack:
1. **Zero Maintenance**: Neon Serverless Postgres scales to zero when idle, costs $0 during development, and provides instantaneous connection pooling.
2. **Zero Egress Fees**: Cloudflare R2 handles evidence artifacts without bandwidth costs.
3. **High Uptime**: Eliminates dependencies on local Docker or WSL2 containers that shut down when the developer closes their laptop.

