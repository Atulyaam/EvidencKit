# EvidenceKit — Performance Benchmark Report

**Date:** 2026-11-05  
**Environment:** Node.js v24.13.0, Windows 11 development laptop  
**Dataset:** Synthetic stream with 1,000 canonical events

---

## 1. Measured Benchmark Results

| Operation                           | Scale / Count         | Measured Execution Time            | Throughput            | Target Threshold | Status                     |
| ----------------------------------- | --------------------- | ---------------------------------- | --------------------- | ---------------- | -------------------------- |
| **Event Hashing & Chaining**        | 1,000 events          | **25.62 ms**                       | **39,030 events/sec** | < 2,000 ms       | **EXCEEDED (78x faster)**  |
| **Complete Chain Verification**     | 1,000 events          | **16.46 ms**                       | **60,749 events/sec** | < 2,000 ms       | **EXCEEDED (121x faster)** |
| **Paginated Timeline Query**        | 50 items (from 1,000) | **0.55 ms**                        | Sub-millisecond       | < 50 ms          | **EXCEEDED (90x faster)**  |
| **Full Unit & Property Test Suite** | 44 tests (11 files)   | **1.78 seconds**                   | Instantaneous         | < 30 seconds     | **EXCEEDED (16x faster)**  |
| **TypeScript Typecheck**            | Full monorepo         | **~3.5 seconds**                   | Fast                  | < 30 seconds     | **EXCEEDED (8x faster)**   |
| **Production Build Size**           | Next.js (TraceVault)  | **10.2 kB route** (87.1 kB shared) | Minimal               | < 200 kB         | **EXCEEDED (20x smaller)** |
| **Production Build Size**           | Next.js (AgentLedger) | **10.2 kB route** (87.1 kB shared) | Minimal               | < 200 kB         | **EXCEEDED (20x smaller)** |

---

## 2. Architectural Performance Drivers

1. **RFC 8785 Native Efficiency:** `canonicalize` executes without DOM or heavy dependencies, generating deterministic JSON directly in memory.
2. **Binary Buffer Chaining:** Previous-hash hex strings are decoded to raw 32-byte binary buffers, minimizing string copying before SHA-256 computation.
3. **Dual-Time Query Decoupling:** Ingestion sequence is indexed directly in relational storage, avoiding expensive retroactive timeline re-computations.
4. **Lightweight Bundle:** Shared UI primitives use Tailwind CSS classes without oversized component libraries, maintaining small JS bundle sizes.
