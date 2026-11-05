# EvidenceKit

**Kiroween 2026 Hackathon — Skeleton Crew Category**  
_Reusable, tamper-evident event-evidence engine demonstrated through two distinct applications: TraceVault and AgentLedger._

---

## Overview

EvidenceKit accepts structured events and source artifacts, normalizes them into a versioned canonical envelope, redacts sensitive credentials, appends records to an RFC 8785 canonicalized SHA-256 hash chain, and presents an evidence-backed timeline with portable export capabilities.

The same shared engine powers two independent applications:

1. **TraceVault (`apps/tracevault`):** Software incident evidence reconstruction from CI workflows, Git history, deployment records, and application logs.
2. **AgentLedger (`apps/agentledger`):** Instrumented AI-agent workflow and action auditing (tool calls, human approvals, file changes, and execution outcomes).

---

## Target Architecture

```text
evidencekit/
│
├── .kiro/                       # Kiro specifications, steering rules, and quality hooks
│   ├── specs/
│   ├── steering/
│   └── hooks/
│
├── apps/
│   ├── tracevault/              # Next.js 14 incident reconstruction app (Port 3001)
│   └── agentledger/             # Next.js 14 AI-agent auditing app (Port 3002)
│
├── packages/
│   ├── evidence-core/           # Canonical Zod schema, RFC 8785 JCS, SHA-256 chain, redaction
│   ├── evidence-server/         # Transactional append, verification service, auth, health
│   ├── adapters/                # CI, Git, Deployment, and Log source parsers
│   ├── agent-sdk/               # Client SDK for instrumenting AI agents
│   ├── db/                      # Drizzle ORM schema, migrations, connection pool
│   └── ui/                      # Shared investigation design system primitives
│
├── docs/                        # Complete audit, traceability, security & benchmark reports
├── tests/                       # Unit, integration, property-based, and benchmark tests
└── package.json                 # Monorepo configuration with pnpm workspaces
```

---

## Quickstart & Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run Verification & Quality Gates

```bash
# Code formatting check
pnpm format:check

# ESLint check
pnpm lint

# TypeScript strict typecheck
pnpm typecheck

# Automated tests (Unit, Property-Based, Benchmarks)
pnpm test
```

### 3. Build Both Applications

```bash
pnpm build
```

### 4. Start Applications

```bash
# Start both applications concurrently
pnpm dev

# Or start TraceVault individually (http://localhost:3001)
pnpm dev:tracevault

# Or start AgentLedger individually (http://localhost:3002)
pnpm dev:agentledger
```

### 5. Database Commands (PostgreSQL + Drizzle)

```bash
# Generate SQL migrations
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Seed demo data
pnpm db:seed
```

---

## Cryptographic Hash-Chain Specification

For every event `i` in an evidence stream:

```text
canonical_event_i = JCS(event_envelope_i)

hash_input_i =
  UTF8("EvidenceKit:event:v1\n") ||
  HEX_DECODE(previous_hash_i) ||
  UTF8("\n") ||
  UTF8(canonical_event_i)

event_hash_i = SHA256(hash_input_i)
```

- Initial vector for event 0: 32 zero bytes (`"0".repeat(64)`).
- Canonicalization: RFC 8785 JSON Canonicalization Scheme (JCS).
- Invariance: Append sequence (`ingest_sequence`) is immutable; chronological order (`occurred_at`) is computed dynamically at query time.

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
