"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@evidencekit/ui";
import { Download, ShieldCheck, Copy, ExternalLink, Lock } from "lucide-react";

export default function SessionExportPage({ params }: { params: { id: string } }) {
  const [bundle, setBundle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);

  useEffect(() => {
    const loadBundle = async () => {
      try {
        const res = await fetch(`/api/agentledger/sessions/${params.id}/export`);
        if (res.ok) {
          const data = await res.json();
          setBundle(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    loadBundle();
  }, [params.id]);

  const handleCopy = () => {
    if (bundle) {
      navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async () => {
    setVerifyStatus("Verifying...");
    try {
      const res = await fetch("/api/agentledger/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundle)
      });
      const data = await res.json();
      if (data.valid) {
        setVerifyStatus(
          `VERIFIED: All ${data.verification.total_events} events verified. Head hash matched.`
        );
      } else {
        setVerifyStatus(`FAILED: ${data.errors.join(", ")}`);
      }
    } catch (err: any) {
      setVerifyStatus(`Verification error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Download className="w-5 h-5 text-purple-400" /> EvidenceKit Portable Export Bundle
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Export self-contained, cryptographically verifiable audit records conforming to RFC 8785
            canonical format.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-xs border-zinc-700 hover:bg-zinc-800 text-zinc-300"
          >
            <Copy className="w-3.5 h-3.5 mr-1" /> {copied ? "Copied!" : "Copy JSON"}
          </Button>

          <a href={`/api/agentledger/sessions/${params.id}/export?download=true`} download>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white text-xs">
              <Download className="w-3.5 h-3.5 mr-1" /> Download Bundle JSON
            </Button>
          </a>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 text-sm">Generating export bundle...</div>
      ) : !bundle ? (
        <Card className="bg-zinc-900/40 border-zinc-800 text-center p-12 text-zinc-400 text-sm">
          No export bundle could be generated for this session.
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Manifest Card */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="bg-zinc-900/60 border-zinc-800 shadow-xl">
              <CardHeader className="pb-3 border-b border-zinc-800">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400" /> Cryptographic Manifest
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">Format:</span>
                  <span className="text-zinc-300">
                    {bundle.manifest.format_name} v{bundle.manifest.format_version}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">Stream Type:</span>
                  <span className="text-purple-300">{bundle.manifest.stream_type}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">Event Count:</span>
                  <span className="text-zinc-300">{bundle.manifest.event_count}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">Sequence Range:</span>
                  <span className="text-zinc-300">
                    #{bundle.manifest.first_sequence} → #{bundle.manifest.last_sequence}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">Canonicalization:</span>
                  <span className="text-zinc-300">{bundle.manifest.canonicalization}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">Hash Algorithm:</span>
                  <span className="text-zinc-300">{bundle.manifest.hash_algorithm}</span>
                </div>

                <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] space-y-1">
                  <span className="text-zinc-500 block text-[10px] uppercase">Chain Head Hash</span>
                  <span className="text-purple-400 break-all">
                    {bundle.manifest.chain_head_hash}
                  </span>
                </div>

                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={handleVerify}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" /> Verify Bundle In-Browser
                  </Button>
                </div>

                {verifyStatus && (
                  <div
                    className={`p-3 rounded-lg text-xs font-mono ${
                      verifyStatus.startsWith("VERIFIED")
                        ? "bg-emerald-950/80 border border-emerald-800 text-emerald-200"
                        : "bg-red-950/80 border border-red-800 text-red-200"
                    }`}
                  >
                    {verifyStatus}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-400 space-y-2">
              <p className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> Independent Verification
              </p>
              <p>
                This bundle is completely portable and can be verified by any third-party auditor
                using the open EvidenceKit CLI or the web verification screen.
              </p>
              <Link
                href="/verify"
                className="text-purple-400 hover:text-purple-300 font-medium inline-block"
              >
                Open Verification Screen →
              </Link>
            </div>
          </div>

          {/* JSON Bundle Preview */}
          <div className="lg:col-span-7">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3 border-b border-zinc-800 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Bundle JSON Payload</CardTitle>
                <span className="text-xs text-zinc-500 font-mono">
                  {JSON.stringify(bundle).length} bytes
                </span>
              </CardHeader>
              <CardContent className="p-4">
                <pre className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-[540px] leading-relaxed whitespace-pre-wrap">
                  {JSON.stringify(bundle, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
