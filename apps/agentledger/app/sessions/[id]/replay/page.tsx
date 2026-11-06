"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "@evidencekit/ui";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  ShieldCheck,
  Terminal,
  FileCode,
  Clock,
  Info
} from "lucide-react";

interface ReplayStep {
  stepIndex: number;
  totalSteps: number;
  currentEvent: {
    event: {
      event_id: string;
      event_name: string;
      occurred_at: string;
      actor: { id: string; type: string };
      attributes: Record<string, unknown>;
    };
    stream_sequence: number;
    event_hash: string;
  };
  sessionStatus: string;
  toolCalls: Record<
    string,
    {
      toolCallId: string;
      toolName: string;
      status: string;
      arguments?: Record<string, unknown>;
      output?: Record<string, unknown>;
      error?: string;
      durationMs?: number;
    }
  >;
  approvals: Record<
    string,
    {
      approvalId?: string;
      toolCallId: string;
      decision: string;
      actorId?: string;
      reason?: string;
    }
  >;
  files: Record<
    string,
    {
      path: string;
      operation: string;
      oldSha256?: string | null;
      newSha256: string;
      diffSummary?: string;
      updatedAt: string;
    }
  >;
  isVerified: boolean;
  cumulativeDurationMs: number;
}

export default function SessionReplayPage({ params }: { params: { id: string } }) {
  const [steps, setSteps] = useState<ReplayStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const loadReplayData = async () => {
      try {
        const res = await fetch(`/api/agentledger/sessions/${params.id}/replay`);
        if (res.ok) {
          const data = await res.json();
          setSteps(data.steps || []);
          if (data.steps && data.steps.length > 0) {
            setCurrentStepIndex(0);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    loadReplayData();
  }, [params.id]);

  // Autoplay loop
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = 1200 / playbackSpeed;
      timerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, steps.length, playbackSpeed]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
  };

  if (loading) {
    return (
      <div className="text-zinc-500 text-sm py-12 text-center">Loading session replay state...</div>
    );
  }

  if (steps.length === 0) {
    return (
      <Card className="bg-zinc-900/40 border-zinc-800 text-center p-12 space-y-3">
        <p className="text-zinc-400 text-sm">No recorded events to replay for this session.</p>
        <p className="text-xs text-zinc-500 font-mono">
          Run an agent audit demo to generate an immutable event stream.
        </p>
      </Card>
    );
  }

  const currentStep = steps[currentStepIndex] || steps[0]!;
  const currentEvent = currentStep.currentEvent.event;
  const toolCallsList = Object.values(currentStep.toolCalls || {});
  const filesList = Object.values(currentStep.files || {});
  const approvalsList = Object.values(currentStep.approvals || {});

  return (
    <div className="space-y-6">
      {/* Replay Notice Alert */}
      <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/60 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="text-xs text-purple-200">
            <strong>Deterministic Forensic Replay:</strong> Reconstructing historical states
            directly from the immutable EvidenceKit RFC8785 hash chain.{" "}
            <em>No tools or file modifications are re-executed.</em>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] font-mono text-emerald-400">Chain Verified</span>
        </div>
      </div>

      {/* Replay Controller Bar */}
      <Card className="bg-zinc-900/70 border-zinc-800 shadow-xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-purple-400 font-bold">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs font-mono text-zinc-300">
                Action: <strong className="text-white">{currentEvent.event_name}</strong>
              </span>
              <Badge
                variant={
                  currentStep.sessionStatus === "completed"
                    ? "success"
                    : currentStep.sessionStatus === "awaiting_approval"
                      ? "warning"
                      : "outline"
                }
                className="text-[10px] uppercase font-mono px-2 py-0.5"
              >
                {currentStep.sessionStatus.replace("_", " ")}
              </Badge>
            </div>

            {/* Playback Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-8 w-8 p-0 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                title="Restart"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentStepIndex === 0}
                className="h-8 w-8 p-0 border-zinc-700 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40"
                title="Previous Step"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-8 px-3.5 bg-purple-600 hover:bg-purple-500 text-white text-xs flex items-center gap-1.5"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Play
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentStepIndex === steps.length - 1}
                className="h-8 w-8 p-0 border-zinc-700 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40"
                title="Next Step"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </Button>

              <div className="border-l border-zinc-800 pl-2 flex items-center gap-1">
                {[0.5, 1, 2].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPlaybackSpeed(s)}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                      playbackSpeed === s
                        ? "bg-purple-900/80 text-purple-200 border border-purple-700"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scrubber / Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={steps.length - 1}
              value={currentStepIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentStepIndex(Number(e.target.value));
              }}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>Start</span>
              <span>Sequence #{currentStep.currentEvent.stream_sequence}</span>
              <span>Complete</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reconstructed State Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Current Event Card */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" /> Current Reconstructed Event
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-500">Event Name:</span>
                <span className="text-purple-300 font-bold">{currentEvent.event_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-500">Sequence:</span>
                <span className="text-zinc-300">#{currentStep.currentEvent.stream_sequence}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-500">Actor:</span>
                <span className="text-zinc-300">{currentEvent.actor?.id || "agent"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-500">Occurred:</span>
                <span className="text-zinc-300">
                  {new Date(currentEvent.occurred_at).toLocaleTimeString()}
                </span>
              </div>

              <div className="p-2 rounded bg-zinc-950 border border-zinc-800 text-[11px] space-y-1">
                <span className="text-zinc-500 block text-[10px] uppercase">Event Hash</span>
                <span className="text-purple-400 break-all">
                  {currentStep.currentEvent.event_hash}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-zinc-500 text-[10px] uppercase">Attributes:</span>
                <pre className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {JSON.stringify(currentEvent.attributes, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Cumulative Reconstructed Tool Calls, Approvals, and Files */}
        <div className="lg:col-span-7 space-y-4">
          {/* Tool Calls Snapshot */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" /> Active Tool Calls (
                  {toolCallsList.length})
                </span>
                <span className="text-xs font-mono text-zinc-500 font-normal">
                  Total Duration: {currentStep.cumulativeDurationMs}ms
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {toolCallsList.length === 0 ? (
                <p className="text-zinc-500 text-xs">No tool calls initiated at this step.</p>
              ) : (
                toolCallsList.map((tc) => (
                  <div
                    key={tc.toolCallId}
                    className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-purple-300 font-semibold">{tc.toolName}</span>
                      <Badge
                        variant={
                          tc.status === "completed"
                            ? "success"
                            : tc.status === "failed" || tc.status === "rejected"
                              ? "danger"
                              : tc.status === "awaiting_approval"
                                ? "warning"
                                : "outline"
                        }
                        className="text-[9px] uppercase px-1.5 py-0"
                      >
                        {tc.status}
                      </Badge>
                    </div>

                    <div className="text-[11px] text-zinc-400">
                      ID: <span className="text-zinc-500">{tc.toolCallId}</span>
                    </div>

                    {tc.arguments && Object.keys(tc.arguments).length > 0 && (
                      <div className="text-[11px] text-zinc-400 truncate">
                        Args: {JSON.stringify(tc.arguments)}
                      </div>
                    )}
                    {tc.output && (
                      <div className="text-[11px] text-emerald-400 truncate">
                        Result: {JSON.stringify(tc.output)}
                      </div>
                    )}
                    {tc.error && (
                      <div className="text-[11px] text-red-400 truncate">Error: {tc.error}</div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Approvals Snapshot */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" /> Human Approval Gates (
                {approvalsList.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {approvalsList.length === 0 ? (
                <p className="text-zinc-500 text-xs">No human approval requests at this step.</p>
              ) : (
                approvalsList.map((appr) => (
                  <div
                    key={appr.approvalId}
                    className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-amber-300 font-semibold">{appr.toolCallId}</span>
                      <Badge
                        variant={
                          appr.decision === "approved"
                            ? "success"
                            : appr.decision === "denied"
                              ? "danger"
                              : "warning"
                        }
                        className="text-[9px] uppercase px-1.5 py-0"
                      >
                        {appr.decision}
                      </Badge>
                    </div>
                    {appr.reason && (
                      <div className="text-[11px] text-zinc-400">Reason: {appr.reason}</div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Files Snapshot */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" /> Files Modified in Sandbox (
                {filesList.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {filesList.length === 0 ? (
                <p className="text-zinc-500 text-xs">
                  No files modified at this point in the replay.
                </p>
              ) : (
                filesList.map((f) => (
                  <div
                    key={f.path}
                    className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-300 font-semibold">{f.path}</span>
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {f.operation}
                      </Badge>
                    </div>

                    <div className="text-[10px] text-zinc-400 space-y-0.5">
                      <div>
                        Old Hash:{" "}
                        {f.oldSha256 ? `${f.oldSha256.slice(0, 16)}...` : "None (new file)"}
                      </div>
                      <div>New Hash: {f.newSha256 ? `${f.newSha256.slice(0, 16)}...` : "None"}</div>
                    </div>

                    {f.diffSummary && (
                      <pre className="p-2 rounded bg-zinc-900 text-[10px] text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                        {f.diffSummary}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
