import crypto from "node:crypto";
import { z } from "zod";
import { canonicalizeJson } from "../canonicalize/index";

export const SIGNATURE_DISCLAIMER =
  "SIGNATURE NOTICE: A valid Ed25519 signature cryptographically confirms that the export manifest was signed by the holder of the corresponding private key and has not been altered since generation. It does NOT prove that the underlying source evidence is truthful.";

export const SignatureReceiptSchema = z.object({
  algorithm: z.literal("Ed25519"),
  key_id: z.string().min(1),
  public_key: z.string().min(1), // Base64 SPKI
  public_key_fingerprint: z.string().length(64), // SHA-256 hex
  signature_value: z.string().min(1), // Base64
  signed_at: z.string().datetime()
});
export type SignatureReceipt = z.infer<typeof SignatureReceiptSchema>;

export interface KeyPairResult {
  keyId: string;
  publicKeyBase64: string;
  privateKeyBase64: string;
  fingerprint: string;
}

export interface TrustedKeyEntry {
  keyId: string;
  publicKeyBase64: string;
  fingerprint: string;
  description?: string;
  addedAt: string;
  revokedAt?: string | null;
}

/**
 * Registry of pinned, trusted public keys for authenticating evidence signatures.
 * Prevents public-key substitution / self-signed manifest forgery (SEC-002).
 */
export class TrustedKeyRegistry {
  private keysByFingerprint: Map<string, TrustedKeyEntry> = new Map();
  private keysById: Map<string, TrustedKeyEntry> = new Map();

  constructor(initialKeys?: TrustedKeyEntry[]) {
    if (initialKeys) {
      for (const k of initialKeys) {
        this.registerKey(k);
      }
    }
  }

  public registerKey(
    entry: Omit<TrustedKeyEntry, "fingerprint" | "addedAt"> & {
      fingerprint?: string;
      addedAt?: string;
    }
  ): TrustedKeyEntry {
    const fingerprint = entry.fingerprint || computePublicKeyFingerprint(entry.publicKeyBase64);
    const fullEntry: TrustedKeyEntry = {
      keyId: entry.keyId,
      publicKeyBase64: entry.publicKeyBase64,
      fingerprint: fingerprint.toLowerCase(),
      description: entry.description,
      addedAt: entry.addedAt || new Date().toISOString(),
      revokedAt: entry.revokedAt || null
    };

    this.keysByFingerprint.set(fullEntry.fingerprint, fullEntry);
    this.keysById.set(fullEntry.keyId, fullEntry);
    return fullEntry;
  }

  public isTrusted(publicKeyBase64: string, keyId?: string): boolean {
    const fingerprint = computePublicKeyFingerprint(publicKeyBase64).toLowerCase();
    const entry = this.keysByFingerprint.get(fingerprint);
    if (!entry) return false;
    if (entry.revokedAt !== null) return false;
    if (keyId && entry.keyId !== keyId) return false;
    return true;
  }

  public getKey(keyIdOrFingerprint: string): TrustedKeyEntry | undefined {
    return (
      this.keysById.get(keyIdOrFingerprint) ||
      this.keysByFingerprint.get(keyIdOrFingerprint.toLowerCase())
    );
  }

  public revokeKey(keyIdOrFingerprint: string): boolean {
    const entry = this.getKey(keyIdOrFingerprint);
    if (!entry) return false;
    entry.revokedAt = new Date().toISOString();
    return true;
  }

  public getAllKeys(): TrustedKeyEntry[] {
    return Array.from(this.keysByFingerprint.values());
  }

  public clear(): void {
    this.keysByFingerprint.clear();
    this.keysById.clear();
  }
}

export const globalTrustedKeyRegistry = new TrustedKeyRegistry();

/**
 * Generates a new Ed25519 key pair for server-side evidence signing and rotation.
 */
export function generateEd25519KeyPair(keyId: string = "ek-signer-2026"): KeyPairResult {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  const publicKeyBase64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  const privateKeyBase64 = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");

  const fingerprint = computePublicKeyFingerprint(publicKeyBase64);

  return {
    keyId,
    publicKeyBase64,
    privateKeyBase64,
    fingerprint
  };
}

/**
 * Computes the SHA-256 fingerprint (hex) of a Base64-encoded public key.
 */
export function computePublicKeyFingerprint(publicKeyBase64: string): string {
  return crypto.createHash("sha256").update(Buffer.from(publicKeyBase64, "base64")).digest("hex");
}

/**
 * Signs an export manifest canonically using Ed25519 private key.
 */
export function signExportManifest(
  manifest: Record<string, unknown>,
  privateKeyBase64: string,
  keyId: string,
  publicKeyBase64: string
): SignatureReceipt {
  const canonicalManifest = canonicalizeJson(manifest);
  const dataToSign = Buffer.from(canonicalManifest, "utf8");

  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyBase64, "base64"),
    format: "der",
    type: "pkcs8"
  });

  const signatureBuffer = crypto.sign(null, dataToSign, privateKey);
  const fingerprint = computePublicKeyFingerprint(publicKeyBase64);

  return {
    algorithm: "Ed25519",
    key_id: keyId,
    public_key: publicKeyBase64,
    public_key_fingerprint: fingerprint,
    signature_value: signatureBuffer.toString("base64"),
    signed_at: new Date().toISOString()
  };
}

export type VerificationStatus =
  | "VERIFIED"
  | "INVALID_SIGNATURE"
  | "TAMPERED"
  | "UNSIGNED"
  | "UNTRUSTED_KEY"
  | "UNSUPPORTED_VERSION"
  | "UNSUPPORTED_ALGORITHM"
  // Backwards compatibility legacy lowercase statuses
  | "verified"
  | "invalid"
  | "unsigned"
  | "error";

export interface SignatureVerificationResult {
  valid: boolean;
  status: VerificationStatus;
  evidenceIntegrity: boolean;
  signatureValidity: boolean;
  signerTrusted: boolean;
  algorithm?: string;
  keyId?: string;
  fingerprint?: string;
  error?: string;
  disclaimer: string;
}

export interface VerifySignatureOptions {
  trustedRegistry?: TrustedKeyRegistry;
  trustedPublicKeys?: string[];
  allowUnsigned?: boolean;
  requireTrustedSigner?: boolean;
}

/**
 * Independently verifies an Ed25519 digital signature against a canonical export manifest.
 * Separates evidence integrity, signature mathematical validity, and signer trust.
 */
export function verifyManifestSignature(
  manifest: Record<string, unknown>,
  signatureReceipt?: SignatureReceipt | null,
  options?: VerifySignatureOptions
): SignatureVerificationResult {
  const allowUnsigned = options?.allowUnsigned ?? false;
  const requireTrusted = options?.requireTrustedSigner ?? true;

  if (!signatureReceipt) {
    if (allowUnsigned) {
      return {
        valid: true,
        status: "UNSIGNED",
        evidenceIntegrity: true,
        signatureValidity: false,
        signerTrusted: false,
        disclaimer: SIGNATURE_DISCLAIMER,
        error: "Legacy Unsigned Bundle (unsigned format permitted by configuration)"
      };
    }
    return {
      valid: false,
      status: "UNSIGNED",
      evidenceIntegrity: true,
      signatureValidity: false,
      signerTrusted: false,
      disclaimer: SIGNATURE_DISCLAIMER,
      error:
        "Digital signature is required but missing (signature was stripped or bundle is unsigned)"
    };
  }

  try {
    // 0. Validate format version
    if (
      manifest?.format_version &&
      manifest.format_version !== "1.0" &&
      manifest.format_version !== "2.0"
    ) {
      return {
        valid: false,
        status: "UNSUPPORTED_VERSION",
        evidenceIntegrity: false,
        signatureValidity: false,
        signerTrusted: false,
        error: `Unsupported format_version: '${manifest.format_version}'. Supported versions are 1.0 and 2.0.`,
        disclaimer: SIGNATURE_DISCLAIMER
      };
    }

    // 1. Validate signature algorithm
    if (signatureReceipt.algorithm !== "Ed25519") {
      return {
        valid: false,
        status: "UNSUPPORTED_ALGORITHM",
        evidenceIntegrity: false,
        signatureValidity: false,
        signerTrusted: false,
        error: `Unsupported signature algorithm: ${signatureReceipt.algorithm}`,
        disclaimer: SIGNATURE_DISCLAIMER
      };
    }

    // 2. Validate public key fingerprint
    const computedFingerprint = computePublicKeyFingerprint(signatureReceipt.public_key);
    if (
      computedFingerprint.toLowerCase() !== signatureReceipt.public_key_fingerprint.toLowerCase()
    ) {
      return {
        valid: false,
        status: "INVALID_SIGNATURE",
        evidenceIntegrity: false,
        signatureValidity: false,
        signerTrusted: false,
        error: "Public key fingerprint mismatch: public_key does not match claimed fingerprint",
        disclaimer: SIGNATURE_DISCLAIMER
      };
    }

    // 3. Reconstruct canonical manifest bytes
    const canonicalManifest = canonicalizeJson(manifest);
    const dataToVerify = Buffer.from(canonicalManifest, "utf8");

    const publicKey = crypto.createPublicKey({
      key: Buffer.from(signatureReceipt.public_key, "base64"),
      format: "der",
      type: "spki"
    });

    const signatureBuffer = Buffer.from(signatureReceipt.signature_value, "base64");

    const isVerified = crypto.verify(null, dataToVerify, publicKey, signatureBuffer);

    if (!isVerified) {
      return {
        valid: false,
        status: "INVALID_SIGNATURE",
        evidenceIntegrity: false,
        signatureValidity: false,
        signerTrusted: false,
        keyId: signatureReceipt.key_id,
        fingerprint: signatureReceipt.public_key_fingerprint,
        error:
          "Ed25519 digital signature verification failed. Manifest was altered or signed with a different key.",
        disclaimer: SIGNATURE_DISCLAIMER
      };
    }

    // 4. Verify Signer Trust against Trusted Key Registry (SEC-002)
    const registry = options?.trustedRegistry || globalTrustedKeyRegistry;
    let isTrusted = false;

    if (options?.trustedPublicKeys && options.trustedPublicKeys.length > 0) {
      const targetFingerprint = computedFingerprint.toLowerCase();
      isTrusted = options.trustedPublicKeys.some(
        (pk) =>
          pk === signatureReceipt.public_key ||
          computePublicKeyFingerprint(pk).toLowerCase() === targetFingerprint
      );
    } else {
      isTrusted = registry.isTrusted(signatureReceipt.public_key, signatureReceipt.key_id);
    }

    if (requireTrusted && !isTrusted) {
      return {
        valid: false,
        status: "UNTRUSTED_KEY",
        evidenceIntegrity: true,
        signatureValidity: true,
        signerTrusted: false,
        keyId: signatureReceipt.key_id,
        fingerprint: signatureReceipt.public_key_fingerprint,
        algorithm: "Ed25519",
        error: `Signature is mathematically valid, but public key (${signatureReceipt.public_key_fingerprint.slice(0, 16)}...) is not in the trusted key registry.`,
        disclaimer: SIGNATURE_DISCLAIMER
      };
    }

    return {
      valid: true,
      status: "VERIFIED",
      evidenceIntegrity: true,
      signatureValidity: true,
      signerTrusted: isTrusted,
      algorithm: "Ed25519",
      keyId: signatureReceipt.key_id,
      fingerprint: signatureReceipt.public_key_fingerprint,
      disclaimer: SIGNATURE_DISCLAIMER
    };
  } catch (err: any) {
    return {
      valid: false,
      status: "INVALID_SIGNATURE",
      evidenceIntegrity: false,
      signatureValidity: false,
      signerTrusted: false,
      error: `Signature verification error: ${err?.message || "Malformed key or signature"}`,
      disclaimer: SIGNATURE_DISCLAIMER
    };
  }
}
