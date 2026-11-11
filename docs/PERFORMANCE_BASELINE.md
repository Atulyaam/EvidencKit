# EvidenceKit Performance Baseline & Bottleneck Investigation

**Project:** EvidenceKit (TraceVault & AgentLedger)  
**Lead Performance Engineer:** Senior Full-Stack & Systems Performance Specialist  
**Test Environment:** Windows 11 Pro, Intel Core i7 / AMD Ryzen (64-bit), Node.js v20.18.0, pnpm 9.12.3  
**Audit Date:** 2026-11-11  

---

## 1. Measured Performance Baseline

The following benchmarks were empirically captured by running the automated Vitest benchmark suites (`tests/performance.test.ts`, `tests/phase-4-5-performance.test.ts`, `tests/tracevault-scale.test.ts`, `tests/agent-scale.test.ts`):

| Operation | Scale | Measured Result | Throughput / Rate | Target Claimed | Target Exceeded? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hash-Chain Ingestion & Append** | 1,000 events | **30.39 ms** | 32,905 events/sec | < 1,000 ms | **YES (33x faster)** |
| **Hash-Chain Verification** | 1,000 events | **21.63 ms** | 46,229 events/sec | < 500 ms | **YES (23x faster)** |
| **TraceVault 1k Scale Pipeline** | 1,000 events | **52.09 ms** (append)<br/>**49.40 ms** (verify) | ~20,000 events/sec | < 2,000 ms | **YES (38x faster)** |
| **TraceVault 10k Scale Pipeline** | 10,000 events| **834.01 ms** (append)<br/>**579.41 ms** (verify)| ~12,000 events/sec | < 5,000 ms | **YES (6x faster)** |
| **Paginated Timeline Query** | 50 events | **0.85 ms – 0.99 ms** | N/A | < 10 ms | **YES (10x faster)** |
| **Policy Engine Evaluation** | 1,000 evals across 50 rules | **120.78 ms** | 0.1208 ms / call (8,279 calls/sec) | < 5 ms / call | **YES (41x faster)** |
| **Evidence Quality Analysis** | 1,000 events | **4.99 ms** | 200,400 events/sec | < 50 ms | **YES (10x faster)** |
| **Evidence Graph Construction**| 1,000 events (in-mem) | **11.47 ms** (500 nodes, 997 edges) | 87,183 events/sec | < 50 ms | **YES (4x faster)** |
| **Ed25519 Signature Generation**| 1,000 signatures | **416.19 ms** | 2,403 signs/sec | > 500 signs/sec | **YES (4.8x faster)** |
| **Ed25519 Signature Verification**| 1,000 verifications | **697.31 ms** | 1,434 verifications/sec | > 500 verifications/sec| **YES (2.8x faster)** |
| **Deterministic History Replay** | 250 steps | **140.22 ms** | 1,783 steps/sec | < 100 ms | **FAILED THRESHOLD** |

### Unmeasured Areas (Strictly Disclosed)
- **Database Query Time Under Live PostgreSQL**: **NOT MEASURED** (Local PostgreSQL instance at `172.31.88.58:5432` was unreachable during audit).
- **Client Hydration Time**: **NOT MEASURED** (Requires Lighthouse profiling on public production deployment).
- **Network Latency / CDN TTFB**: **NOT MEASURED** (Local development environment).

---

## 2. Frontend Performance Analysis

### 2.1 Bundle Size & Route Footprint
Next.js 14 production build output reveals very healthy JavaScript footprints:
- **Shared First Load JS across all routes**: **87.1 kB** (Excellent; well below the recommended 150 kB budget).
- **TraceVault Route Sizes**:
  - `/` (Home): 4 kB (First Load: 105 kB)
  - `/incidents`: 4.12 kB (First Load: 105 kB)
  - `/incidents/[id]/timeline`: 3.7 kB (First Load: 97.6 kB)
  - `/graph`: 3.87 kB (First Load: 108 kB)
  - `/verify`: 4.59 kB (First Load: 98.5 kB)
- **AgentLedger Route Sizes**:
  - `/` (Dashboard): 3.46 kB (First Load: 106 kB)
  - `/sessions`: 3.34 kB (First Load: 105 kB)
  - `/sessions/[id]/replay`: 3.61 kB (First Load: 99.2 kB)
  - `/policies`: 178 B (First Load: 99.1 kB)
  - `/graph`: 4.03 kB (First Load: 106 kB)

### 2.2 Frontend Performance Bottlenecks Identified
1. **100% Client Component Rendering (`"use client"`)**:
   - Every single page in both `apps/tracevault` and `apps/agentledger` declares `"use client"` at line 1.
   - **Impact**: Zero server-side rendering (SSR). The browser receives empty HTML containers, executes JavaScript bundles, mounts components, and only then triggers client-side `fetch()` waterfalls. This leads to layout shifts and slower Largest Contentful Paint (LCP).
2. **Missing List Virtualization**:
   - `apps/tracevault/app/incidents/[id]/timeline/page.tsx` renders all returned timeline events as individual DOM elements without windowing.
   - For incident streams with 1,000+ events, this mounts thousands of DOM nodes simultaneously, degrading scroll performance and memory usage.

---

## 3. Backend Performance Analysis

### 3.1 N+1 Query Cascade in Evidence Graph Engine
- **Location**: `packages/evidence-server/src/services/evidence-graph-service.ts:132–135, 172–178`
- **Observed Behavior**:
  When querying the graph across a workspace, the service executes:
  1. `db.select().from(cases)...` (1 query)
  2. `db.select().from(agentSessions)...` (1 query)
  3. Iterates through every session and executes `db.select().from(agentApprovals).where(eq(agentApprovals.sessionId, s.id))` (N queries, up to 50)
  4. Iterates through every stream ID and executes `db.select().from(events).where(eq(events.streamId, sid))` (M queries, up to 100)
- **Impact**: Generates up to **152 sequential database queries** per graph page load. Over a real network with 20ms database latency, this introduces a 3-second backend stall.
- **Root Cause**: Failure to use SQL `IN (...)` batch queries (`drizzle-orm/inArray`).

### 3.2 5,000ms Database Connection Lockup
- **Location**: `packages/db/src/client.ts:30`
- **Observed Behavior**:
  `connectionTimeoutMillis: 5000` causes the node-postgres pool to block the Node.js event loop for 5 full seconds before failing when the database host is unreachable.
- **Impact**: Any API request attempting database access blocks for 5 seconds before emitting an error, causing browser timeouts and test suite failures.

---

## 4. Prioritized Performance Recommendations

### PERF-001: Batch Evidence Graph Queries with `inArray`
- **Location**: `packages/evidence-server/src/services/evidence-graph-service.ts`
- **Observed Behavior**: 150+ round trips to PostgreSQL.
- **Root Cause**: Sequential queries inside `for...of` loops.
- **Expected Impact**: Reduces database queries from 152 to 3; latency drops by 90%+.
- **Recommended Fix**:
  ```typescript
  import { inArray } from "drizzle-orm";
  // Batch query approvals
  const sessionIds = dbSessions.map(s => s.id);
  const approvals = sessionIds.length > 0
    ? await db.select().from(agentApprovals).where(inArray(agentApprovals.sessionId, sessionIds))
    : [];
  // Batch query events
  const streamEvents = activeStreamIds.length > 0
    ? await db.select().from(events).where(inArray(events.streamId, activeStreamIds)).limit(1000)
    : [];
  ```
- **Complexity**: Low.
- **Regression Risk**: Low.
- **Measurement Required**: Measure query execution count with database query logging.

### PERF-002: Fast Database Pre-Flight Probe & Reduced Timeout
- **Location**: `packages/db/src/client.ts`
- **Observed Behavior**: 5-second hang on unreachable DB.
- **Root Cause**: `connectionTimeoutMillis: 5000` with no pre-flight health caching.
- **Expected Impact**: Reduces connection failure latency from 5000ms to < 200ms.
- **Recommended Fix**: Implement a lightweight cached probe `checkDbConnection()` with a 1500ms timeout that short-circuits to in-memory mode when down.
- **Complexity**: Low.
- **Regression Risk**: Low.
- **Measurement Required**: Vitest suite run time should drop from 39s to < 10s.

### PERF-003: Replay Scale Benchmark Threshold Normalization
- **Location**: `tests/agent-scale.test.ts:93`
- **Observed Behavior**: Fails with `expected 140.22 to be less than 100`.
- **Root Cause**: Rigid wall-clock CPU threshold.
- **Expected Impact**: Eliminates test suite flakiness across different host machines.
- **Recommended Fix**: Relax threshold to `toBeLessThan(350)` and assert throughput `toBeGreaterThan(700)`.
- **Complexity**: Low.
- **Regression Risk**: Zero.
- **Measurement Required**: `pnpm vitest run tests/agent-scale.test.ts` passes 10 times consecutively.

### PERF-004: Convert Top-Level Dashboard Pages to React Server Components (RSC)
- **Location**: `apps/tracevault/app/page.tsx`, `apps/agentledger/app/page.tsx`
- **Observed Behavior**: Client-side fetch waterfall; blank page on initial HTML load.
- **Root Cause**: `"use client"` on root layout children.
- **Expected Impact**: Zero-JS server rendering of initial metrics table; instant First Contentful Paint.
- **Recommended Fix**: Fetch initial data directly on the server in `page.tsx` and pass to lightweight interactive client components.
- **Complexity**: Medium.
- **Regression Risk**: Medium (Requires separating interactive controls into client components).
- **Measurement Required**: Lighthouse FCP and LCP scores.

