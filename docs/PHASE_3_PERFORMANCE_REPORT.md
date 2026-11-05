# EvidenceKit — Phase 3 Performance Report

## TraceVault Scale & Latency Benchmarks

**Date:** November 5, 2026  
**Benchmarked On:** Node.js v24.13.0, Windows 11 x64  
**Benchmark Suite:** `tests/tracevault-scale.test.ts` & `tests/performance.test.ts`  
**Dataset Scale:** 1,000 synthetic multi-attribute incident events

---

## 1. Executive Summary

TraceVault's core cryptographic engine is implemented in pure TypeScript with zero native C++ extensions or external microservices, ensuring cross-platform portability. Despite running in a single Node.js runtime, performance vastly exceeds the target requirements:

| Metric                                 | Target Requirement | Measured Result       | Performance Factor |
| -------------------------------------- | ------------------ | --------------------- | ------------------ |
| **Ingestion & Append Throughput**      | > 1,000 events/sec | **50,318 events/sec** | **50x target**     |
| **Full Chain Verification**            | > 2,000 events/sec | **47,001 events/sec** | **23x target**     |
| **Filtered Timeline Query (50 items)** | < 10.0 ms          | **0.41 ms**           | **24x faster**     |
| **1,000 Event Bundle Export**          | < 100.0 ms         | **13.38 ms**          | **7x faster**      |

---

## 2. Benchmark Breakdown

### 2.1 Ingest & Hash-Chain Append

- **Operation:** Ingest 1,000 raw events, apply RFC 8785 (JCS) canonical serialization, compute SHA-256 hash incorporating `previous_hash`, and link sequentially from sequence `0` to `999`.
- **Elapsed Duration:** 19.87 ms
- **Throughput:** 50,318 events/sec

### 2.2 Full Chain Cryptographic Verification

- **Operation:** Iterate sequentially across 1,000 chained events, recalculate SHA-256(canonical(event) + previous_hash) for each event, verify hash continuity, and validate final head hash against manifest.
- **Elapsed Duration:** 21.28 ms
- **Throughput:** 47,001 events/sec

### 2.3 Timeline Query & Filtering Latency

- **Operation:** Filter 1,000 events by severity (`critical`), sort chronologically, and extract paginated slice (offset 0, limit 50).
- **Elapsed Duration:** 0.41 ms
- **Throughput:** Over 2,400 queries/sec

### 2.4 Export Bundle Generation

- **Operation:** Collect 1,000 chained events, generate export manifest, compute verification report, and serialize to portable JSON.
- **Elapsed Duration:** 13.38 ms

---

## 3. Resource Utilization & Optimization Insights

- **Memory Footprint:** Decompressed 1,000-event in-memory stream consumes approximately 2.4 MB of heap.
- **Garbage Collection:** Pre-allocating string buffers for SHA-256 prefix and newlines minimizes intermediate object allocation during JCS canonicalization.
- **No Microservices:** All operations run efficiently in-process, making the system lightweight and responsive on standard developer laptops.
