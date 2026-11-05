"use client";

import { useState, use } from "react";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@evidencekit/ui";

interface EvidencePageProps {
  params: Promise<{ id: string }> | { id: string };
}

interface ValidationPreview {
  detected_adapter: string;
  total_records: number;
  valid_events: number;
  rejected_records: number;
  validation_errors: string[];
  sample_events: any[];
}

export default function EvidenceUploadPage({ params }: EvidencePageProps) {
  const resolvedParams = "then" in params ? use(params) : params;
  const incidentId = resolvedParams.id;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [preview, setPreview] = useState<ValidationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);
    setSuccessMsg(null);
    setAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/incidents/${incidentId}/evidence?preview=true`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to analyze evidence source");
      }

      const data = await res.json();
      setPreview(data);
    } catch (err: any) {
      setError(err.message);
      setPreview(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmIngest = async () => {
    if (!selectedFile) return;

    try {
      setIngesting(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch(`/api/incidents/${incidentId}/evidence`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to ingest evidence");
      }

      const result = await res.json();
      setSuccessMsg(
        `Successfully ingested ${result.ingested_count} events into hash chain! Current head: ${result.head_hash?.slice(0, 16)}...`
      );
      setPreview(null);
      setSelectedFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Dropzone */}
      <Card className="border-zinc-800 bg-zinc-900/60 shadow-lg">
        <CardHeader className="border-b border-zinc-800/80 pb-4">
          <CardTitle className="text-base text-zinc-100">
            Upload & Ingest Evidence Sources
          </CardTitle>
          <p className="text-xs text-zinc-400 mt-1">
            Supported formats: JSONL application logs, Git commit logs (JSON), GitHub Actions/CI
            runs (JSON), Deployments (JSON), EvidenceKit normalized JSON, or full ZIP bundles.
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3 text-xs text-emerald-300 font-mono">
              ✓ {successMsg}
            </div>
          )}

          <div className="border-2 border-dashed border-zinc-700/80 hover:border-blue-500/80 rounded-xl p-8 text-center bg-zinc-900/30 transition-colors">
            <div className="max-w-md mx-auto space-y-3">
              <span className="text-3xl block">📁</span>
              <div className="text-sm font-semibold text-zinc-200">
                {selectedFile ? selectedFile.name : "Select or drag incident evidence file"}
              </div>
              <p className="text-xs text-zinc-500">
                Supports .jsonl, .log, .json, and .zip archives (Zip-Slip and Zip-bomb protected)
              </p>

              <label className="inline-block mt-2">
                <input
                  type="file"
                  className="hidden"
                  accept=".jsonl,.log,.json,.zip"
                  onChange={handleFileChange}
                />
                <span className="cursor-pointer inline-flex items-center justify-center rounded-md font-medium text-xs h-9 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors">
                  Choose File
                </span>
              </label>

              {analyzing && (
                <div className="text-xs text-blue-400 animate-pulse font-mono">
                  Analyzing format and validating schemas...
                </div>
              )}
            </div>
          </div>

          {/* Validation & Normalization Preview Modal/Section */}
          {preview && (
            <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    Pre-Ingestion Validation Preview
                  </span>
                  <Badge variant="default">{preview.detected_adapter}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Total: {preview.total_records}</span>
                  <Badge variant="success">{preview.valid_events} Valid</Badge>
                  {preview.rejected_records > 0 && (
                    <Badge variant="danger">{preview.rejected_records} Rejected</Badge>
                  )}
                </div>
              </div>

              {preview.validation_errors.length > 0 && (
                <div className="rounded-md border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-300 space-y-1">
                  <div className="font-semibold">Validation Warnings / Rejections:</div>
                  <ul className="list-disc pl-5 font-mono text-[11px] space-y-0.5">
                    {preview.validation_errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {preview.validation_errors.length > 5 && (
                      <li>...and {preview.validation_errors.length - 5} more issues</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Sample Event Preview */}
              {preview.sample_events && preview.sample_events.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-semibold">
                    Normalized Event Sample:
                  </span>
                  <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 font-mono text-xs text-zinc-300 max-h-48">
                    {JSON.stringify(preview.sample_events[0], null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmIngest}
                  disabled={ingesting || preview.valid_events === 0}
                >
                  {ingesting
                    ? "Persisting to Hash Chain..."
                    : `Confirm & Ingest ${preview.valid_events} Events`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ingestion Pipeline Specifications */}
      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Ingestion Pipeline Guarantees
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
          <div className="space-y-1">
            <span className="font-semibold text-zinc-200 block">1. Pre-Persistence Redaction</span>
            <p>
              All authorization headers, API keys, JWTs, and database passwords are sanitized before
              being written to storage.
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-zinc-200 block">2. Exact Provenance Locators</span>
            <p>
              Every event preserves source references including record number, line number, or JSON
              pointer back to the raw uploaded file.
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-zinc-200 block">3. Cryptographic Linking</span>
            <p>
              Payloads are canonicalized with RFC 8785 (JCS) and SHA-256 chained. Any tampering
              breaks subsequent hash continuity.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
