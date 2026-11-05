# TraceVault — Known Limitations & Honest Architectural Boundaries

## Kiroween 2026 Hackathon Scope & Boundaries

**Product:** TraceVault  
**Engine:** EvidenceKit  
**Version:** Phase 3 Complete

---

## 1. Scope & Purpose

TraceVault is engineered specifically for **post-capture incident evidence reconstruction**. To maintain rigorous engineering honesty, we explicitly document what TraceVault does and does not do.

---

## 2. Honest Claims & Architectural Boundaries

### 2.1 Post-Capture Integrity vs. Pre-Capture Truth

- **What EvidenceKit Guarantees:** Once an event is captured, canonicalized with RFC 8785, and SHA-256 chained, retroactive alteration, deletion, reordering, or insertion is cryptographically impossible without breaking the hash chain.
- **What EvidenceKit Does Not Guarantee:** EvidenceKit cannot verify whether an external source system (e.g. an application logger or an infected VM) lied or generated inaccurate log data prior to ingestion. Integrity begins at the boundary of ingestion.

### 2.2 Candidate Correlations vs. Proven Causality

- **What EvidenceKit Guarantees:** Deterministic discovery of candidate relationships (e.g. temporal proximity, shared correlation IDs, deployment transitions) using explicit rules (`TV-COR-001` through `TV-COR-005`) with zero hallucinated connections.
- **What EvidenceKit Does Not Guarantee:** We never claim automated "root cause discovery" or proven causation. Human engineers and incident commanders must validate whether a correlated deployment actually caused an outage.

### 2.3 Clock Skew & Inferred Timestamps

- Heterogeneous systems often exhibit clock drift.
- EvidenceKit records `time_confidence` for each event:
  - `source_timestamp`: Direct timestamp extracted from source record.
  - `inferred`: Time inferred from nearby sequences.
  - `ingestion_fallback`: Wall-clock ingestion time when source timestamp is missing.
- When cross-system clocks drift by more than the correlation window (default 15 minutes), candidate correlations may not match unless linked by explicit correlation IDs (`TV-COR-004`).

### 2.4 Pre-Persistence Secret Redaction

- Known pattern redactors sanitize JWTs, Bearer tokens, GitHub tokens, AWS keys, passwords in database connection strings, and private keys.
- Highly unusual or custom proprietary secret formats without standard prefix patterns may require custom regex configuration in `REDACTION_PATTERNS`.

### 2.5 Single-Node Lightweight Deployment

- TraceVault is intentionally designed for a solo engineer or skeleton crew without requiring Kafka, ZooKeeper, microservices, or distributed Consensus protocols (Raft/Paxos).
- For massive enterprise deployments exceeding 100,000 events per second, an external stream ingestion queue (e.g. AWS SQS or Redis Streams) can be placed in front of the `EvidenceUploadService`.
