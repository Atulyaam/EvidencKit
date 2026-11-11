import { describe, it, expect, beforeEach } from "vitest";
import {
  generateEd25519KeyPair,
  SIGNATURE_DISCLAIMER,
  createExportBundle,
  validateImportBundle,
  globalTrustedKeyRegistry,
  ChainedEvent,
  EvidenceEvent
} from "@evidencekit/core";
import { defaultChainService } from "@evidencekit/evidence-server";
import { randomUUID } from "node:crypto";

describe("Phase 4.5 — Ed25519 Signed Evidence Receipts Test Suite", () => {
  const streamId = `case_sig_${Date.now()}`;

  const rawEvent: EvidenceEvent = {
    schema_version: "1.0",
    event_id: randomUUID(),
    stream_type: "tracevault.case",
    stream_id: streamId,
    event_name: "incident.declared",
    occurred_at: "2026-11-06T12:00:00.000Z",
    observed_at: "2026-11-06T12:00:00.100Z",
    time_confidence: "source_timestamp",
    source: { system: "tracevault", adapter: "ui", adapter_version: "1.0" },
    severity: "critical",
    attributes: { reason: "Database starvation" }
  };

  const sampleEvents: ChainedEvent[] = [defaultChainService.appendInMemory(rawEvent)];

  beforeEach(() => {
    globalTrustedKeyRegistry.clear();
  });

  it("generates an Ed25519 key pair with valid SHA-256 fingerprint", () => {
    const keyPair = generateEd25519KeyPair("ek-signer-test");
    expect(keyPair.keyId).toBe("ek-signer-test");
    expect(keyPair.publicKeyBase64).toBeDefined();
    expect(keyPair.privateKeyBase64).toBeDefined();
    expect(keyPair.fingerprint).toHaveLength(64);
  });

  it("creates, signs, and independently verifies a signed export bundle", () => {
    const keyPair = generateEd25519KeyPair("ek-test-key-1");
    globalTrustedKeyRegistry.registerKey({
      keyId: keyPair.keyId,
      publicKeyBase64: keyPair.publicKeyBase64
    });

    const bundle = createExportBundle(streamId, "tracevault.case", sampleEvents, {
      workspaceId: "ws_sig_test",
      signingKey: {
        privateKeyBase64: keyPair.privateKeyBase64,
        publicKeyBase64: keyPair.publicKeyBase64,
        keyId: keyPair.keyId
      }
    });

    expect(bundle.manifest.format_version).toBe("2.0");
    expect(bundle.signature).toBeDefined();
    expect(bundle.signature?.algorithm).toBe("Ed25519");
    expect(bundle.signature?.key_id).toBe("ek-test-key-1");
    expect(bundle.signature?.public_key_fingerprint).toBe(keyPair.fingerprint);

    // Independent verification against trusted registry
    const importValidation = validateImportBundle(bundle, {
      trustedRegistry: globalTrustedKeyRegistry
    });
    expect(importValidation.valid).toBe(true);
    expect(importValidation.signature_verification.status).toBe("VERIFIED");
    expect(importValidation.signature_verification.algorithm).toBe("Ed25519");
    expect(importValidation.signature_verification.keyId).toBe("ek-test-key-1");
    expect(importValidation.signature_verification.fingerprint).toBe(keyPair.fingerprint);
    expect(importValidation.signature_verification.signerTrusted).toBe(true);
    expect(importValidation.signature_verification.disclaimer).toBe(SIGNATURE_DISCLAIMER);
  });

  it("detects manifest tampering and rejects altered signed bundles", () => {
    const keyPair = generateEd25519KeyPair("ek-test-key-tamper");
    globalTrustedKeyRegistry.registerKey({
      keyId: keyPair.keyId,
      publicKeyBase64: keyPair.publicKeyBase64
    });

    const bundle = createExportBundle(streamId, "tracevault.case", sampleEvents, {
      signingKey: {
        privateKeyBase64: keyPair.privateKeyBase64,
        publicKeyBase64: keyPair.publicKeyBase64,
        keyId: keyPair.keyId
      }
    });

    // Tamper with manifest (e.g. change event count)
    const tamperedBundle = JSON.parse(JSON.stringify(bundle));
    tamperedBundle.manifest.event_count = 999;

    const validation = validateImportBundle(tamperedBundle, {
      trustedRegistry: globalTrustedKeyRegistry
    });
    expect(validation.valid).toBe(false);
    expect(validation.signature_verification.status).toBe("INVALID_SIGNATURE");
    expect(validation.errors.some((e) => e.includes("signature verification failed"))).toBe(true);
  });

  it("rejects signatures from untrusted public keys (SEC-002)", () => {
    const untrustedKey = generateEd25519KeyPair("attacker-key");
    // Deliberately DO NOT register untrustedKey in trusted registry

    const bundle = createExportBundle(streamId, "tracevault.case", sampleEvents, {
      signingKey: {
        privateKeyBase64: untrustedKey.privateKeyBase64,
        publicKeyBase64: untrustedKey.publicKeyBase64,
        keyId: untrustedKey.keyId
      }
    });

    const validation = validateImportBundle(bundle, {
      trustedRegistry: globalTrustedKeyRegistry
    });
    expect(validation.valid).toBe(false);
    expect(validation.signature_verification.status).toBe("UNTRUSTED_KEY");
    expect(validation.signature_verification.signerTrusted).toBe(false);
    expect(validation.errors.some((e) => e.includes("not in the trusted key registry"))).toBe(true);
  });

  it("rejects signature stripping on format 2.0 signed bundles (SEC-002)", () => {
    const keyPair = generateEd25519KeyPair("ek-strip-test");
    globalTrustedKeyRegistry.registerKey({
      keyId: keyPair.keyId,
      publicKeyBase64: keyPair.publicKeyBase64
    });

    const bundle = createExportBundle(streamId, "tracevault.case", sampleEvents, {
      signingKey: {
        privateKeyBase64: keyPair.privateKeyBase64,
        publicKeyBase64: keyPair.publicKeyBase64,
        keyId: keyPair.keyId
      }
    });

    // Attacker removes signature from signed bundle
    const strippedBundle = JSON.parse(JSON.stringify(bundle));
    delete strippedBundle.signature;

    const validation = validateImportBundle(strippedBundle, {
      trustedRegistry: globalTrustedKeyRegistry
    });
    expect(validation.valid).toBe(false);
    expect(validation.signature_verification.status).toBe("UNSIGNED");
    expect(validation.errors.some((e) => e.includes("Signature stripping detected"))).toBe(true);
  });

  it("rejects signatures verified against the wrong public key or public key substitution", () => {
    const keyPairA = generateEd25519KeyPair("key-A");
    const keyPairB = generateEd25519KeyPair("key-B");
    globalTrustedKeyRegistry.registerKey({
      keyId: keyPairA.keyId,
      publicKeyBase64: keyPairA.publicKeyBase64
    });
    globalTrustedKeyRegistry.registerKey({
      keyId: keyPairB.keyId,
      publicKeyBase64: keyPairB.publicKeyBase64
    });

    const bundle = createExportBundle(streamId, "tracevault.case", sampleEvents, {
      signingKey: {
        privateKeyBase64: keyPairA.privateKeyBase64,
        publicKeyBase64: keyPairA.publicKeyBase64,
        keyId: keyPairA.keyId
      }
    });

    // Substitute public key with Key B's public key
    const substitutedBundle = JSON.parse(JSON.stringify(bundle));
    substitutedBundle.signature.public_key = keyPairB.publicKeyBase64;
    // Keep fingerprint of key A to test fingerprint mismatch first
    const validationFingerprintMismatch = validateImportBundle(substitutedBundle, {
      trustedRegistry: globalTrustedKeyRegistry
    });
    expect(validationFingerprintMismatch.valid).toBe(false);
    expect(validationFingerprintMismatch.signature_verification.error).toContain(
      "fingerprint mismatch"
    );

    // Update fingerprint to Key B's fingerprint so fingerprint matches, but signature verification fails!
    substitutedBundle.signature.public_key_fingerprint = keyPairB.fingerprint;
    const validationSignatureFailed = validateImportBundle(substitutedBundle, {
      trustedRegistry: globalTrustedKeyRegistry
    });
    expect(validationSignatureFailed.valid).toBe(false);
    expect(validationSignatureFailed.signature_verification.status).toBe("INVALID_SIGNATURE");
  });

  it("maintains backward compatibility with legacy unsigned v1.0 bundles", () => {
    // Legacy unsigned bundle (no signingKey provided)
    const legacyBundle = createExportBundle(streamId, "tracevault.case", sampleEvents);

    expect(legacyBundle.manifest.format_version).toBe("1.0");
    expect(legacyBundle.signature).toBeUndefined();

    const validation = validateImportBundle(legacyBundle, {
      allowUnsigned: true,
      trustedRegistry: globalTrustedKeyRegistry
    });
    expect(validation.valid).toBe(true); // Still structurally & cryptographically valid!
    expect(validation.signature_verification.status).toBe("UNSIGNED");
    expect(validation.signature_verification.error).toContain("Legacy Unsigned Bundle");
  });

  it("supports key rotation across multiple key versions", () => {
    const oldKey = generateEd25519KeyPair("ek-signer-2025");
    const newKey = generateEd25519KeyPair("ek-signer-2026");
    globalTrustedKeyRegistry.registerKey({
      keyId: oldKey.keyId,
      publicKeyBase64: oldKey.publicKeyBase64
    });
    globalTrustedKeyRegistry.registerKey({
      keyId: newKey.keyId,
      publicKeyBase64: newKey.publicKeyBase64
    });

    const bundleOld = createExportBundle(streamId, "tracevault.case", sampleEvents, {
      signingKey: {
        privateKeyBase64: oldKey.privateKeyBase64,
        publicKeyBase64: oldKey.publicKeyBase64,
        keyId: oldKey.keyId
      }
    });

    const bundleNew = createExportBundle(streamId, "tracevault.case", sampleEvents, {
      signingKey: {
        privateKeyBase64: newKey.privateKeyBase64,
        publicKeyBase64: newKey.publicKeyBase64,
        keyId: newKey.keyId
      }
    });

    expect(
      validateImportBundle(bundleOld, { trustedRegistry: globalTrustedKeyRegistry })
        .signature_verification.keyId
    ).toBe("ek-signer-2025");
    expect(
      validateImportBundle(bundleNew, { trustedRegistry: globalTrustedKeyRegistry })
        .signature_verification.keyId
    ).toBe("ek-signer-2026");
    expect(
      validateImportBundle(bundleOld, { trustedRegistry: globalTrustedKeyRegistry }).valid
    ).toBe(true);
    expect(
      validateImportBundle(bundleNew, { trustedRegistry: globalTrustedKeyRegistry }).valid
    ).toBe(true);
  });
});
