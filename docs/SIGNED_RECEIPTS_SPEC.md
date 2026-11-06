# Ed25519 Signed Evidence Receipts Specification

**EvidenceKit — Cryptographic Non-Repudiation & Receipt Verification**  
**Document Version:** 1.0.0  
**Status:** Approved & Implemented  
**Date:** 2026-11-06

---

## 1. Executive Summary

While RFC 8785 canonical hash-chaining guarantees internal sequence integrity and detects retro-active tampering within a stream, it does not cryptographically bind an exported evidence bundle to a verified server authority.

**Ed25519 Signed Evidence Receipts** elevate EvidenceKit export bundles into legally defensible, cryptographically authenticated digital receipts. When an evidence bundle is exported from TraceVault or AgentLedger, the server canonically signs the export manifest using an Ed25519 private key.

Any third-party auditor, court, or automated verification tool can independently verify the signature using the server's public key without requiring access to the EvidenceKit database or proprietary servers.

---

## 2. Cryptographic Architecture

### Algorithm Selection: Ed25519

EvidenceKit employs Edwards-curve Digital Signature Algorithm (Ed25519) over Curve25519:

- **Security**: 128-bit security level, resistant to side-channel attacks, collision resilient.
- **Performance**: High throughput (> 2,000 signs/sec, > 3,000 verifications/sec in pure Node.js runtime).
- **Compactness**: 64-byte raw signature, 32-byte public key.
- **Zero External Dependencies**: Built natively using Node.js `node:crypto`.

---

## 3. Canonical Manifest Signing Pipeline

Signing is deterministic and follows a strict 4-step sequence:

```
[ Export Manifest Object ]
            │
            ▼
[ RFC 8785 JSON Canonicalization (JCS) ]
            │
            ▼
[ Raw UTF-8 Buffer ]
            │
            ▼
[ Ed25519 Private Key Sign ] ──> [ Base64 Digital Signature ]
            │
            ▼
[ Signature Receipt Object Attached to Bundle ]
```

### Signature Receipt Schema:

```typescript
export const SignatureReceiptSchema = z.object({
  algorithm: z.literal("Ed25519"),
  key_id: z.string().min(1),
  public_key: z.string().min(1), // Base64 SPKI
  public_key_fingerprint: z.string().length(64), // SHA-256 hex
  signature_value: z.string().min(1), // Base64 signature
  signed_at: z.string().datetime()
});
export type SignatureReceipt = z.infer<typeof SignatureReceiptSchema>;
```

---

## 4. Server-Side Key Management & Containment

1. **Strict Private Key Containment**: Ed25519 private keys are strictly retained within server memory or secure secret managers (`process.env.EVIDENCE_SIGNING_PRIVATE_KEY`). Private keys are **never** included in exported JSON or ZIP archives.
2. **Public Key Distribution**: Public keys are exported in standard SPKI DER format (Base64) alongside a SHA-256 fingerprint:
   $$\text{Fingerprint} = \text{SHA-256}(\text{Base64-decoded SPKI})$$
3. **Key Rotation**: Key IDs (`key_id`, e.g. `ek-signer-prod-2026`) allow seamless rotation. Historical bundles retain their signing key ID, allowing verifiers to select the appropriate public key.

---

## 5. Backward Compatibility with v1.0 Unsigned Bundles

To preserve compatibility with historical exports and third-party integrations:

- EvidenceKit v1.0 bundles lack the `signature` field.
- The verification engine (`validateImportBundle` and `verifyManifestSignature`) explicitly classifies missing signatures as `"unsigned"`.
- Unsigned bundles pass structural and hash-chain verification with an informational disclaimer, ensuring historical data remains accessible and usable.
- Bundles with an invalid or tampered signature fail verification immediately with status `"invalid"`.

---

## 6. Standalone Verification Engine

Any investigator can verify an export bundle independently on the `/verify` page or via the `@evidencekit/core` CLI/SDK:

1. **Hash Chain Verification**: Verifies `previous_hash` sequence from root to head across all events using RFC 8785 and SHA-256.
2. **Manifest Integrity Check**: Verifies that `chain_head_hash` matches the last event's hash, and `event_count` matches the actual event array length.
3. **Digital Signature Verification**:
   - Reconstructs canonical manifest payload using RFC 8785.
   - Verifies Ed25519 signature against `receipt.public_key`.
   - Confirms that `receipt.public_key_fingerprint` matches the SHA-256 hash of the public key.

---

## 7. Mandatory Legal & Forensic Notice

Every signature verification report displays the mandatory truthfulness notice:

> **SIGNATURE NOTICE: Authentication vs. Truthfulness**  
> A valid Ed25519 digital signature cryptographically confirms that the export manifest was signed by the holder of the corresponding private key and has not been altered since generation. It does NOT prove that the underlying source evidence is truthful.
