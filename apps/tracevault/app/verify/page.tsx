"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Alert,
  Breadcrumbs,
  BreadcrumbItem
} from "@evidencekit/ui";
import {
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  Terminal,
  Upload,
  CheckCircle2,
  XCircle,
  FileUp,
  KeyRound,
  Hash,
  Clock,
  Layers
} from "lucide-react";

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumbs>
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Evidence Verifier</BreadcrumbItem>
      </Breadcrumbs>

      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>🔍 EvidenceKit Cryptographic Verifier</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Verify Evidence Bundle
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
          Upload an exported EvidenceKit portable bundle (.json or .zip) to verify its SHA-256 hash
          chain, Ed25519 digital signature, and RFC 8785 canonical serialization.
        </p>
      </div>

      {/* Air-gapped CLI card */}
      <Card className="border-zinc-800 bg-zinc-900/40 shadow-sm">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <CardTitle className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Air-Gapped Offline Verification (Zero Network)</span>
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            For air-gapped or high-security offline verification without network access, run the
            standalone verification CLI locally:
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="p-3.5 bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-xs text-emerald-400 select-all overflow-x-auto">
            pnpm verify-bundle &lt;path-to-bundle.json|path-to-bundle.zip&gt;
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/60 shadow-xl">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-400" />
            Server-Side Bundle Verification
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400 mt-1">
            Select an exported `.json` bundle or `.zip` archive containing `manifest.json` and
            `events.jsonl` to verify against the server&apos;s trusted public key registry.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {error && (
            <Alert variant="danger" title="Verification Error">
              {error}
            </Alert>
          )}

          <div className="border-2 border-dashed border-zinc-700/80 hover:border-emerald-500/80 rounded-xl p-8 text-center bg-zinc-900/30 transition-colors">
            <div className="max-w-md mx-auto space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                <FileUp className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-zinc-200">
                {file ? file.name : "Select exported bundle file (.json or .zip)"}
              </div>
              <p className="text-xs text-zinc-500">
                Maximum file size: 50MB. Bundle must conform to EvidenceKit Bundle Specification
                v1.1.
              </p>

              <label className="inline-block mt-2">
                <input
                  type="file"
                  className="hidden"
                  accept=".json,.zip"
                  onChange={handleFileChange}
                />
                <span className="cursor-pointer inline-flex items-center justify-center rounded-md font-medium text-xs h-9 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors">
                  Choose File
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-zinc-800/80">
            <Button
              variant="primary"
              disabled={!file || verifying}
              onClick={handleVerify}
              isLoading={verifying}
            >
              {verifying ? "Verifying..." : "Run Server-Side Verification"}
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
          } shadow-2xl animate-in fade-in`}
        >
          <CardHeader className="border-b border-zinc-800/80 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    result.valid && result.verification?.status === "verified"
                      ? "bg-emerald-950/80 border border-emerald-800 text-emerald-400"
                      : "bg-rose-950/80 border border-rose-800 text-rose-400"
                  }`}
                >
                  {result.valid && result.verification?.status === "verified" ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <XCircle className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg text-white font-bold">
                    {result.valid && result.verification?.status === "verified"
                      ? "Cryptographic Verification Passed"
                      : "Integrity Verification Failed / Tampering Detected"}
                  </CardTitle>
                  <span className="text-xs text-zinc-400 font-mono">
                    Stream ID:{" "}
                    {result.manifest?.stream_id || result.verification?.stream_id || "N/A"}
                  </span>
                </div>
              </div>
              <Badge
                variant={
                  result.valid && result.verification?.status === "verified" ? "success" : "danger"
                }
                className="font-mono text-xs uppercase px-3 py-1 self-start sm:self-auto"
              >
                {result.verification?.status?.toUpperCase() || "FAILED"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
              <div className="space-y-1">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Total Events:
                </span>
                <span className="text-zinc-100 font-bold font-mono text-sm block">
                  {result.events?.length || result.verification?.total_events || 0}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                  Canonicalization:
                </span>
                <span className="text-zinc-100 font-mono block">
                  {result.manifest?.canonicalization || "RFC8785-JCS"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-blue-400" />
                  Hash Algorithm:
                </span>
                <span className="text-zinc-100 font-mono block">
                  {result.manifest?.hash_algorithm || "SHA-256"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Verified At:
                </span>
                <span className="text-zinc-100 font-mono block">
                  {new Date(result.verification?.verified_at || Date.now()).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {result.verification?.head_hash && (
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px] block">Chain Head Hash:</span>
                <span className="font-mono text-xs text-blue-400 break-all select-all block">
                  {result.verification.head_hash}
                </span>
              </div>
            )}

            {/* Ed25519 Digital Signature Receipt */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-purple-400" />
                  <span className="text-zinc-300 font-bold font-mono text-xs">
                    Digital Signature:
                  </span>
                  <Badge
                    variant={
                      result.signature_verification?.status === "verified" ||
                      result.signature_verification?.status === "VERIFIED"
                        ? "success"
                        : result.signature_verification?.status === "unsigned" ||
                            result.signature_verification?.status === "UNSIGNED"
                          ? "outline"
                          : "danger"
                    }
                    className="text-[10px] font-mono uppercase"
                  >
                    {result.signature_verification?.status === "verified" ||
                    result.signature_verification?.status === "VERIFIED"
                      ? "Ed25519 Verified & Trusted"
                      : result.signature_verification?.status === "untrusted_key" ||
                          result.signature_verification?.status === "UNTRUSTED_KEY"
                        ? "Untrusted Public Key"
                        : result.signature_verification?.status === "unsigned" ||
                            result.signature_verification?.status === "UNSIGNED"
                          ? "Unsigned Bundle (Legacy v1.0)"
                          : "Signature Invalid / Failed"}
                  </Badge>
                </div>
                {result.signature_verification?.keyId && (
                  <span className="text-[11px] font-mono text-purple-400">
                    Key ID: {result.signature_verification.keyId}
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
                <p className="text-[10px] text-zinc-500 italic pt-2 border-t border-zinc-800/60 leading-relaxed">
                  {result.signature_verification.disclaimer}
                </p>
              )}
            </div>

            {/* Error or Tamper Alert */}
            {(!result.valid || result.verification?.status !== "verified") && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 space-y-2">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Integrity Discrepancy Found:</span>
                </div>
                {result.verification?.failed_at_sequence !== undefined && (
                  <p className="text-xs">
                    Hash chain broken at event sequence{" "}
                    <span className="font-mono font-bold text-rose-200">
                      #{result.verification.failed_at_sequence}
                    </span>
                    .
                  </p>
                )}
                {result.verification?.error && (
                  <p className="text-xs">{result.verification.error}</p>
                )}
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
