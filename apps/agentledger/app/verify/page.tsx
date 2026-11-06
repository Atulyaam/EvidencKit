"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@evidencekit/ui";
import {
  ShieldCheck,
  Upload,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  RotateCcw
} from "lucide-react";

export default function VerifyBundlePage() {
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setJsonInput(text);
      };
      reader.readAsText(file);
    }
  };

  const handleVerify = async () => {
    if (!jsonInput.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const parsed = JSON.parse(jsonInput);
      const res = await fetch("/api/agentledger/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({
        valid: false,
        errors: [`JSON Parse Error: ${err.message}`],
        verification: { status: "failed", error: "Malformed JSON payload" }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setJsonInput("");
    setFileName(null);
    setResult(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-purple-400" /> Independent Evidence Verifier
        </h1>
        <p className="text-xs text-zinc-400">
          Verify any EvidenceKit export bundle from TraceVault or AgentLedger. Validates RFC 8785
          canonical digests and the continuous SHA-256 hash-chain without trusted server state.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload File Card */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3 border-b border-zinc-800">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-400" /> Upload Export Bundle (.json)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-700 hover:border-purple-500 rounded-xl cursor-pointer bg-zinc-950/60 transition-colors">
              <FileText className="w-8 h-8 text-zinc-500 mb-2" />
              <span className="text-xs text-zinc-300 font-medium">
                {fileName ? fileName : "Click to select or drop bundle JSON"}
              </span>
              <span className="text-[10px] text-zinc-500 mt-1">
                Accepts evidencekit-export v1.0 bundles
              </span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </CardContent>
        </Card>

        {/* Action / Paste Option */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3 border-b border-zinc-800">
            <CardTitle className="text-sm font-semibold">Verification Controls</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <p className="text-xs text-zinc-400">
              The verifier recomputes all SHA-256 digests in strict sequence order, compares against
              previous hashes, and verifies that the chain head matches the bundle manifest.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={handleVerify}
                disabled={!jsonInput.trim() || loading}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs h-9 flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />{" "}
                {loading ? "Verifying..." : "Verify Bundle Integrity"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-9 px-3 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Raw JSON input textarea */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-mono font-semibold uppercase text-zinc-400">
            Bundle JSON Content:
          </CardTitle>
          <span className="text-[10px] font-mono text-zinc-500">
            {jsonInput.length > 0 ? `${jsonInput.length} chars` : "Paste or upload"}
          </span>
        </CardHeader>
        <CardContent className="p-4">
          <textarea
            rows={8}
            placeholder="Paste bundle JSON here or use the file upload above..."
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] font-mono text-zinc-300 outline-none focus:border-purple-500 whitespace-pre"
          />
        </CardContent>
      </Card>

      {/* Verification Result Banner */}
      {result && (
        <Card
          className={`border shadow-xl ${
            result.valid
              ? "bg-emerald-950/40 border-emerald-700/80"
              : "bg-red-950/40 border-red-700/80"
          }`}
        >
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              {result.valid ? (
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center shrink-0">
                  <XCircle className="w-6 h-6 text-red-400" />
                </div>
              )}

              <div>
                <h3 className="text-base font-bold text-white">
                  {result.valid
                    ? "CRYPTOGRAPHIC INTEGRITY VERIFIED"
                    : "VERIFICATION FAILED: TAMPERING DETECTED"}
                </h3>
                <p className="text-xs text-zinc-300 mt-0.5">
                  {result.valid
                    ? "All events in the bundle were verified sequentially with zero tampering. Hash chain is unbroken."
                    : "The bundle contains sequence gaps, invalid hashes, or modified payloads."}
                </p>
              </div>
            </div>

            {/* Metrics breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 font-mono text-xs border-t border-zinc-800/80">
              <div className="p-2.5 rounded bg-zinc-950/80 border border-zinc-800/60">
                <span className="text-zinc-500 block text-[10px] uppercase">Status</span>
                <span
                  className={`font-semibold ${result.valid ? "text-emerald-400" : "text-red-400"}`}
                >
                  {result.valid ? "VERIFIED" : "FAILED"}
                </span>
              </div>

              <div className="p-2.5 rounded bg-zinc-950/80 border border-zinc-800/60">
                <span className="text-zinc-500 block text-[10px] uppercase">Total Events</span>
                <span className="text-zinc-200">{result.verification?.total_events || 0}</span>
              </div>

              <div className="p-2.5 rounded bg-zinc-950/80 border border-zinc-800/60">
                <span className="text-zinc-500 block text-[10px] uppercase">Stream ID</span>
                <span className="text-zinc-200 truncate block">
                  {result.manifest?.stream_id || result.verification?.stream_id || "N/A"}
                </span>
              </div>

              <div className="p-2.5 rounded bg-zinc-950/80 border border-zinc-800/60">
                <span className="text-zinc-500 block text-[10px] uppercase">Canonical JCS</span>
                <span className="text-purple-300">RFC 8785</span>
              </div>
            </div>

            {/* Error List if Failed */}
            {(!result.valid || (result.errors && result.errors.length > 0)) && (
              <div className="space-y-2 pt-2 border-t border-red-900/40">
                <span className="text-xs font-semibold text-red-300 flex items-center gap-1.5 font-mono uppercase">
                  <AlertTriangle className="w-3.5 h-3.5" /> Defect & Inconsistency Diagnostics:
                </span>
                <ul className="space-y-1 font-mono text-xs text-red-200 list-disc list-inside bg-red-950/60 p-3 rounded-lg border border-red-800/60">
                  {result.errors?.map((err: string, i: number) => (
                    <li key={i}>{err}</li>
                  ))}
                  {result.verification?.error && <li>{result.verification.error}</li>}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
