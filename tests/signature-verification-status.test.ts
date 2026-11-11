import { describe, it, expect, beforeEach } from "vitest";
import {
  generateEd25519KeyPair,
  signExportManifest,
  verifyManifestSignature,
  TrustedKeyRegistry,
  validateImportBundle,
  createExportBundle,
  ExportManifest,
  ChainedEvent
} from "@evidencekit/core";
import { randomUUID } from "node:crypto";

describe("Cryptographic Signature Verification Statuses Suite (SEC-002, SEC-003)", () => {
  let trustedRegistry: TrustedKeyRegistry;
  let trustedKey: ReturnType<typeof generateEd25519KeyPair>;
  let untrustedKey: ReturnType<typeof generateEd25519KeyPair>;

  const sampleManifest: ExportManifest = {
    format_name: "evidencekit-export",
    format_version: "2.0",
    export_id: "exp_test_01",
    stream_id: "stream_test_01",
    stream_type: "agentledger.session",
    workspace_id: "ws_demo_default",
    created_at: new Date().toISOString(),
    event_count: 1,
    chain_head_hash: "a".repeat(64),
    hash_algorithm: "sha-256",
    canonicalization: "RFC8785-JCS",
    artifact_manifest: []
  };

  const sampleEvents: ChainedEvent[] = [
    {
      event: {
        schema_version: "1.0",
        event_id: randomUUID(),
        stream_type: "agentledger.session",
        stream_id: "stream_test_01",
        event_name: "agent.session.created",
        occurred_at: new Date().toISOString(),
        observed_at: new Date().toISOString(),
        time_confidence: "source_timestamp",
        source: { system: "agent", adapter: "test", adapter_version: "1.0" },
        severity: "info",
        attributes: {}
      },
      stream_sequence: 1,
      previous_hash: "0".repeat(64),
      event_hash: "a".repeat(64)
    }
  ];

  beforeEach(() => {
    trustedRegistry = new TrustedKeyRegistry();
    trustedKey = generateEd25519KeyPair("key_trusted_official");
    untrustedKey = generateEd25519KeyPair("key_untrusted_attacker");

    // Register only trustedKey
    trustedRegistry.registerKey({
      keyId: trustedKey.keyId,
      publicKeyBase64: trustedKey.publicKeyBase64,
      description: "Official Authority Key"
    });
  });

  it("returns VERIFIED when signature is mathematically valid and key is in trusted registry", () => {
    const signature = signExportManifest(
      sampleManifest as unknown as Record<string, unknown>,
      trustedKey.privateKeyBase64,
      trustedKey.keyId,
      trustedKey.publicKeyBase64
    );

    const result = verifyManifestSignature(
      sampleManifest as unknown as Record<string, unknown>,
      signature,
      { trustedRegistry }
    );

    expect(result.valid).toBe(true);
    expect(result.status).toBe("VERIFIED");
    expect(result.evidenceIntegrity).toBe(true);
    expect(result.signatureValidity).toBe(true);
    expect(result.signerTrusted).toBe(true);
  });

  it("returns UNTRUSTED_KEY when signature is valid but key is not trusted (prevents public key substitution)", () => {
    const attackerSignature = signExportManifest(
      sampleManifest as unknown as Record<string, unknown>,
      untrustedKey.privateKeyBase64,
      untrustedKey.keyId,
      untrustedKey.publicKeyBase64
    );

    const result = verifyManifestSignature(
      sampleManifest as unknown as Record<string, unknown>,
      attackerSignature,
      { trustedRegistry }
    );

    expect(result.valid).toBe(false);
    expect(result.status).toBe("UNTRUSTED_KEY");
    expect(result.evidenceIntegrity).toBe(true);
    expect(result.signatureValidity).toBe(true);
    expect(result.signerTrusted).toBe(false);
    expect(result.error).toContain("not in the trusted key registry");
  });

  it("returns INVALID_SIGNATURE when manifest content has been altered after signing", () => {
    const signature = signExportManifest(
      sampleManifest as unknown as Record<string, unknown>,
      trustedKey.privateKeyBase64,
      trustedKey.keyId,
      trustedKey.publicKeyBase64
    );

    const tamperedManifest = {
      ...sampleManifest,
      event_count: 999 // Tampered
    };

    const result = verifyManifestSignature(
      tamperedManifest as unknown as Record<string, unknown>,
      signature,
      { trustedRegistry }
    );

    expect(result.valid).toBe(false);
    expect(result.status).toBe("INVALID_SIGNATURE");
    expect(result.signatureValidity).toBe(false);
  });

  it("returns UNSIGNED and detects signature stripping when format_version is 2.0 but signature is removed", () => {
    const bundle = createExportBundle(
      sampleManifest.stream_id,
      sampleManifest.stream_type,
      sampleEvents,
      { signingKey: trustedKey }
    );

    // Attacker strips signature
    const strippedBundle = {
      ...bundle,
      signature: undefined
    };

    const result = validateImportBundle(strippedBundle, {
      trustedRegistry
    });

    expect(result.valid).toBe(false);
    expect(result.signature_verification.status).toBe("UNSIGNED");
    expect(result.errors.some((e) => e.includes("Signature stripping detected"))).toBe(true);
  });

  it("returns UNSUPPORTED_VERSION when format_version is invalid or unknown", () => {
    const invalidVersionManifest = {
      ...sampleManifest,
      format_version: "3.5"
    };

    const signature = signExportManifest(
      invalidVersionManifest as unknown as Record<string, unknown>,
      trustedKey.privateKeyBase64,
      trustedKey.keyId,
      trustedKey.publicKeyBase64
    );

    const result = verifyManifestSignature(
      invalidVersionManifest as unknown as Record<string, unknown>,
      signature,
      { trustedRegistry }
    );

    expect(result.valid).toBe(false);
    expect(result.status).toBe("UNSUPPORTED_VERSION");
    expect(result.error).toContain("Unsupported format_version: '3.5'");
  });

  it("returns UNSUPPORTED_ALGORITHM when signature algorithm is not Ed25519", () => {
    const fakeSignature = {
      algorithm: "RSA-SHA256" as any,
      key_id: "test",
      public_key: "AAAA",
      public_key_fingerprint: "a".repeat(64),
      signature_value: "BBBB",
      signed_at: new Date().toISOString()
    };

    const result = verifyManifestSignature(
      sampleManifest as unknown as Record<string, unknown>,
      fakeSignature,
      { trustedRegistry }
    );

    expect(result.valid).toBe(false);
    expect(result.status).toBe("UNSUPPORTED_ALGORITHM");
  });
});
