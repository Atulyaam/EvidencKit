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

/**
 * Generates a new Ed25519 key pair for server-side evidence signing and rotation.
 */
export function generateEd25519KeyPair(keyId: string = "ek-signer-2026"): KeyPairResult {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  const publicKeyBase64 = publicKey
    .export({ type: "spki", format: "der" })
    .toString("base64");
  const privateKeyBase64 = privateKey
    .export({ type: "pkcs8", format: "der" })
    .toString("base64");

  const fingerprint = crypto
    .createHash("sha256")
    .update(Buffer.from(publicKeyBase64, "base64"))
    .digest("hex");

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
  return crypto
    .createHash("sha256")
    .update(Buffer.from(publicKeyBase64, "base64"))
    .digest("hex");
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

export interface SignatureVerificationResult {
  valid: boolean;
  status: "verified" | "invalid" | "unsigned" | "error";
  algorithm?: string;
  keyId?: string;
  fingerprint?: string;
  error?: string;
  disclaimer: string;
}

/**
 * Independently verifies an Ed25519 digital signature against a canonical export manifest.
 */
export function verifyManifestSignature(
  manifest: Record<string, unknown>,
  signatureReceipt?: SignatureReceipt | null
): SignatureVerificationResult {
  if (!signatureReceipt) {
    return {
      valid: true, // Legacy unsigned bundles remain structurally valid
      status: "unsigned",
      disclaimer: SIGNATURE_DISCLAIMER,
      error: "No digital signature provided (Legacy Unsigned Bundle v1.0)"
    };
  }

  try {
    // 1. Validate signature algorithm
    if (signatureReceipt.algorithm !== "Ed25519") {
      return {
        valid: false,
        status: "invalid",
        error: `Unsupported signature algorithm: ${signatureReceipt.algorithm}`,
        disclaimer: SIGNATURE_DISCLAIMER
      };
    }

    // 2. Validate public key fingerprint
    const computedFingerprint = computePublicKeyFingerprint(signatureReceipt.public_key);
    if (
      computedFingerprint.toLowerCase() !==
      signatureReceipt.public_key_fingerprint.toLowerCase()
    ) {
      return {
        valid: false,
        status: "invalid",
        error: "Public key fingerprint mismatch",
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
        status: "invalid",
        keyId: signatureReceipt.key_id,
        fingerprint: signatureReceipt.public_key_fingerprint,
        error: "Ed25519 digital signature verification failed. Manifest was altered or signed with a different key.",
        disclaimer: SIGNATURE_DISCLAIMER
      };
    }

    return {
      valid: true,
      status: "verified",
      algorithm: "Ed25519",
      keyId: signatureReceipt.key_id,
      fingerprint: signatureReceipt.public_key_fingerprint,
      disclaimer: SIGNATURE_DISCLAIMER
    };
  } catch (err: any) {
    return {
      valid: false,
      status: "error",
      error: `Signature verification error: ${err?.message || "Malformed key or signature"}`,
      disclaimer: SIGNATURE_DISCLAIMER
    };
  }
}

