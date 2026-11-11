import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { validateImportBundle, globalTrustedKeyRegistry, ChainedEvent } from "@evidencekit/core";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log("EvidenceKit Offline Bundle Verifier (Air-Gapped CLI)");
    console.log("Usage: pnpm verify-bundle <path-to-bundle.json|path-to-bundle.zip>");
    console.log("Options:");
    console.log("  --allow-unsigned    Allow bundles without digital signatures");
    console.log("  --trust-key <id:b64> Register an additional trusted public key");
    process.exit(1);
  }

  const bundlePath = path.resolve(process.cwd(), args[0]!);
  if (!fs.existsSync(bundlePath)) {
    console.error(`Error: File not found: ${bundlePath}`);
    process.exit(1);
  }

  const allowUnsigned = args.includes("--allow-unsigned");

  // Optional custom trusted key
  const trustKeyArg = args.find((a) => a.startsWith("--trust-key="));
  if (trustKeyArg) {
    const [keyId, pubB64] = trustKeyArg.split("=")[1]!.split(":");
    if (keyId && pubB64) {
      globalTrustedKeyRegistry.registerKey({
        keyId,
        publicKeyBase64: pubB64,
        description: "CLI user-provided trusted key"
      });
    }
  }

  console.log(`[EvidenceKit] Verifying bundle offline: ${bundlePath}`);
  const ext = path.extname(bundlePath).toLowerCase();

  let validationResult;

  if (ext === ".zip") {
    const zipData = fs.readFileSync(bundlePath);
    const zip = await JSZip.loadAsync(zipData);
    const manifestFile = zip.file("manifest.json");
    const eventsFile = zip.file("events.jsonl");
    const signatureFile = zip.file("signature.json");

    if (!manifestFile || !eventsFile) {
      console.error("Error: Missing manifest.json or events.jsonl inside ZIP bundle");
      process.exit(1);
    }

    const manifest = JSON.parse(await manifestFile.async("string"));
    const eventsText = await eventsFile.async("string");
    const events: ChainedEvent[] = eventsText
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));

    let signature = undefined;
    if (signatureFile) {
      try {
        signature = JSON.parse(await signatureFile.async("string"));
      } catch {
        // ignore
      }
    }

    validationResult = validateImportBundle(
      { manifest, signature, events },
      { allowUnsigned, trustedRegistry: globalTrustedKeyRegistry }
    );
  } else {
    const rawText = fs.readFileSync(bundlePath, "utf-8");
    const bundleJson = JSON.parse(rawText);
    validationResult = validateImportBundle(bundleJson, {
      allowUnsigned,
      trustedRegistry: globalTrustedKeyRegistry
    });
  }

  console.log("==================================================");
  console.log(
    `Overall Result:        ${validationResult.valid ? "PASSED (VALID)" : "FAILED (INVALID)"}`
  );
  console.log(`Format Version:        ${validationResult.manifest?.format_version || "unknown"}`);
  console.log(`Stream ID:             ${validationResult.manifest?.stream_id || "unknown"}`);
  console.log(`Events Count:          ${validationResult.events.length}`);
  console.log(`Hash Chain Integrity:  ${validationResult.verification.status.toUpperCase()}`);
  console.log(
    `Signature Status:      ${validationResult.signature_verification?.status || "UNSIGNED"}`
  );
  console.log(
    `Signature Valid:       ${validationResult.signature_verification?.valid ? "YES" : "NO"}`
  );
  if (validationResult.signature_verification?.signerTrusted !== undefined) {
    console.log(
      `Signer Trusted:        ${validationResult.signature_verification?.signerTrusted ? "YES" : "NO"}`
    );
  }
  if (validationResult.signature_verification?.keyId) {
    console.log(`Key ID:                ${validationResult.signature_verification.keyId}`);
  }

  if (validationResult.errors.length > 0) {
    console.log("Errors:");
    for (const err of validationResult.errors) {
      console.log(`  - ${err}`);
    }
  }
  console.log("==================================================");

  if (!validationResult.valid) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal verification error:", err.message);
  process.exit(1);
});
