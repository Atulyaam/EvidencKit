"use client";

import { useState } from "react";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@evidencekit/ui";

export default function VerifyBundlePage() {
  const [file, setFile] = useState<File | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
    }
  };

  const handleVerify = async () => {
    if (!file) return;

    try {
      setVerifying(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/evidence/verify", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Verification failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-medium">
          <span>🔍 Independent Cryptographic Verifier</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          Verify Evidence Bundle
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
          Upload an exported EvidenceKit portable bundle (.json or .zip) to independently verify its
          SHA-256 hash chain and RFC 8785 canonical serialization without relying on server trust.
        </p>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/60 shadow-xl">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <CardTitle className="text-base text-zinc-100">Upload Bundle</CardTitle>
          <p className="text-xs text-zinc-400 mt-0.5">
            Select a exported `.json` bundle or `.zip` archive containing `manifest.json` and
            `events.jsonl`.
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="border-2 border-dashed border-zinc-700/80 hover:border-emerald-500/80 rounded-xl p-8 text-center bg-zinc-900/30 transition-colors">
            <div className="max-w-md mx-auto space-y-3">
              <span className="text-3xl block">🔐</span>
              <div className="text-sm font-semibold text-zinc-200">
                {file ? file.name : "Select evidence bundle file"}
              </div>
              <p className="text-xs text-zinc-500">Supports .json and .zip files</p>

              <label className="inline-block mt-2">
                <input
                  type="file"
                  className="hidden"
                  accept=".json,.zip"
                  onChange={handleFileChange}
                />
                <span className="cursor-pointer inline-flex items-center justify-center rounded-md font-medium text-xs h-9 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors">
                  Choose Bundle
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="primary" disabled={!file || verifying} onClick={handleVerify}>
              {verifying ? "Verifying Hash Chain..." : "Run Independent Verification"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Verification Result Display */}
      {result && (
        <Card
          className={`border ${
            result.valid && result.verification?.status === "verified"
              ? "border-emerald-800/80 bg-emerald-950/15"
              : "border-rose-800/80 bg-rose-950/20"
          } shadow-xl`}
        >
          <CardHeader className="border-b border-zinc-800/80 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {result.valid && result.verification?.status === "verified" ? "✅" : "❌"}
                </span>
                <div>
                  <CardTitle className="text-lg text-white">
                    {result.valid && result.verification?.status === "verified"
                      ? "Cryptographic Verification Passed"
                      : "Integrity Verification Failed / Tampering Detected"}
                  </CardTitle>
                  <span className="text-xs text-zinc-400">
                    Stream ID:{" "}
                    {result.manifest?.stream_id || result.verification?.stream_id || "N/A"}
                  </span>
                </div>
              </div>
              <Badge
                variant={
                  result.valid && result.verification?.status === "verified" ? "success" : "danger"
                }
              >
                {result.verification?.status?.toUpperCase() || "FAILED"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-zinc-950/80 border border-zinc-800">
              <div>
                <span className="text-zinc-500 block">Total Events:</span>
                <span className="text-zinc-100 font-bold font-mono">
                  {result.events?.length || result.verification?.total_events || 0}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Canonicalization:</span>
                <span className="text-zinc-100 font-mono">
                  {result.manifest?.canonicalization || "RFC8785-JCS"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Hash Algorithm:</span>
                <span className="text-zinc-100 font-mono">
                  {result.manifest?.hash_algorithm || "SHA-256"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Verified At:</span>
                <span className="text-zinc-100 font-mono">
                  {new Date(result.verification?.verified_at || Date.now()).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {result.verification?.head_hash && (
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-500 block mb-1">Chain Head Hash:</span>
                <span className="font-mono text-[11px] text-blue-400 break-all">
                  {result.verification.head_hash}
                </span>
              </div>
            )}

            {/* Ed25519 Digital Signature Receipt */}
            <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-bold font-mono">Digital Signature:</span>
                  <Badge
                    variant={
                      result.signature_verification?.status === "verified"
                        ? "success"
                        : result.signature_verification?.status === "unsigned"
                          ? "outline"
                          : "danger"
                    }
                    className="text-[10px] font-mono uppercase"
                  >
                    {result.signature_verification?.status === "verified"
                      ? "Ed25519 Signed & Verified"
                      : result.signature_verification?.status === "unsigned"
                        ? "Unsigned Bundle (Legacy v1.0)"
                        : "Signature Invalid / Failed"}
                  </Badge>
                </div>
                {result.signature_verification?.keyId && (
                  <span className="text-[11px] font-mono text-purple-400">
                    Key: {result.signature_verification.keyId}
                  </span>
                )}
              </div>

              {result.signature_verification?.fingerprint && (
                <div className="text-[11px] font-mono text-zinc-400">
                  <span className="text-zinc-500">Public Key Fingerprint: </span>
                  <span className="text-cyan-400 break-all">
                    {result.signature_verification.fingerprint}
                  </span>
                </div>
              )}

              {result.signature_verification?.disclaimer && (
                <p className="text-[10px] text-zinc-500 italic pt-1 border-t border-zinc-800/60">
                  {result.signature_verification.disclaimer}
                </p>
              )}
            </div>

            {/* Error or Tamper Alert */}
            {(!result.valid || result.verification?.status !== "verified") && (
              <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 space-y-2">
                <div className="font-semibold text-sm">Integrity Discrepancy Found:</div>
                {result.verification?.failed_at_sequence !== undefined && (
                  <p>
                    Hash chain broken at event sequence{" "}
                    <span className="font-mono font-bold">
                      #{result.verification.failed_at_sequence}
                    </span>
                    .
                  </p>
                )}
                {result.verification?.error && <p>{result.verification.error}</p>}
                {result.errors && result.errors.length > 0 && (
                  <ul className="list-disc pl-5 font-mono text-[11px] space-y-1">
                    {result.errors.map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
