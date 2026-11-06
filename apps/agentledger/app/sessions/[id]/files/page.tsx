"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@evidencekit/ui";
import { FileCode, ShieldCheck } from "lucide-react";

interface FileChangeItem {
  eventId: string;
  sequence: number;
  timestamp: string;
  toolCallId: string;
  path: string;
  operation: "create" | "modify" | "delete";
  oldSha256?: string | null;
  newSha256: string;
  linesAdded?: number;
  linesRemoved?: number;
  diffSummary?: string;
}

export default function SessionFilesPage({ params }: { params: { id: string } }) {
  const [files, setFiles] = useState<FileChangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileChangeItem | null>(null);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const res = await fetch(`/api/agentledger/sessions/${params.id}/files`);
        if (res.ok) {
          const data = await res.json();
          setFiles(data.files || []);
          if (data.files && data.files.length > 0) {
            setSelectedFile(data.files[0]);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [params.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileCode className="w-5 h-5 text-emerald-400" /> Sandboxed File Modifications & Diffs
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real cryptographic before/after SHA-256 digests and bounded unified diffs calculated
            from actual file bytes.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{files.length} Modified Files</span>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500 text-sm">Loading file modifications...</div>
      ) : files.length === 0 ? (
        <Card className="bg-zinc-900/40 border-zinc-800 text-center p-12 space-y-2">
          <FileCode className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">
            No file modifications recorded for this session yet.
          </p>
          <p className="text-xs text-zinc-500 font-mono">
            Files modified during tool executions appear here with cryptographic hashes.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* File List Column */}
          <div className="lg:col-span-5 space-y-3">
            {files.map((file, idx) => {
              const isSelected =
                selectedFile?.path === file.path && selectedFile?.sequence === file.sequence;
              return (
                <div
                  key={`${file.path}-${idx}`}
                  onClick={() => setSelectedFile(file)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer font-mono text-xs space-y-2 ${
                    isSelected
                      ? "bg-purple-950/30 border-purple-500/80 shadow-md shadow-purple-950/40"
                      : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-300 truncate">{file.path}</span>
                    <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0">
                      {file.operation}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Seq #{file.sequence}</span>
                    <span className="flex items-center gap-1.5 text-zinc-500">
                      <span className="text-emerald-400">+{file.linesAdded || 0}</span>
                      <span className="text-red-400">-{file.linesRemoved || 0}</span>
                    </span>
                  </div>

                  <div className="text-[10px] text-zinc-500 truncate">
                    Tool Call: {file.toolCallId}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Diff & Hash Inspector Column */}
          <div className="lg:col-span-7">
            {selectedFile && (
              <Card className="bg-zinc-900/60 border-zinc-800 shadow-xl space-y-4">
                <CardHeader className="pb-3 border-b border-zinc-800 flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-mono font-semibold text-white">
                      {selectedFile.path}
                    </CardTitle>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      Recorded: {new Date(selectedFile.timestamp).toLocaleString()}
                    </p>
                  </div>

                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {selectedFile.operation}
                  </Badge>
                </CardHeader>

                <CardContent className="p-5 space-y-5 text-xs font-mono">
                  {/* Hashes */}
                  <div className="space-y-2">
                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                      <span className="text-zinc-500 block text-[10px] uppercase">
                        Previous SHA-256
                      </span>
                      <span className="text-zinc-400 break-all">
                        {selectedFile.oldSha256 || "None (File created by agent)"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                      <span className="text-zinc-500 block text-[10px] uppercase">
                        Post-Change SHA-256
                      </span>
                      <span className="text-emerald-400 break-all">{selectedFile.newSha256}</span>
                    </div>
                  </div>

                  {/* Diff Viewer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="text-[11px] uppercase tracking-wider font-semibold">
                        Bounded Unified Diff:
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {selectedFile.linesAdded || 0} additions, {selectedFile.linesRemoved || 0}{" "}
                        deletions
                      </span>
                    </div>

                    <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed">
                      {selectedFile.diffSummary ? (
                        selectedFile.diffSummary.split("\n").map((line, i) => (
                          <div
                            key={i}
                            className={`py-0.5 px-1 rounded ${
                              line.startsWith("+")
                                ? "bg-emerald-950/50 text-emerald-300"
                                : line.startsWith("-")
                                  ? "bg-red-950/50 text-red-300"
                                  : "text-zinc-400"
                            }`}
                          >
                            {line}
                          </div>
                        ))
                      ) : (
                        <div className="text-zinc-500 italic">No diff content available.</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
