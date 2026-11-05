# EvidenceKit — Product Steering Rules

1. **Dual Application Requirement:** EvidenceKit is a reusable engine demonstrated through TraceVault (software incident reconstruction) and AgentLedger (AI-agent session auditing).
2. **Honest Claims:** Say "tamper-evident after capture", not "tamper-proof". Say "evidence-backed timeline", not "definitive reconstruction of reality". Say "candidate relationship", not "proven root cause".
3. **Core Reusability:** Cryptographic, canonicalization, normalization, and verification logic must live in shared packages (`evidence-core`), never duplicated inside applications.
4. **Judge Mode:** Public demo mode must be strictly read-only with synthetic sample cases and sessions.
