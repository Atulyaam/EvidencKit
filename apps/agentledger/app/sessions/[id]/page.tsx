"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@evidencekit/ui";
import {
  History,
  Play,
  AlertTriangle,
  FileCode,
  ShieldCheck,
  Bot,
  Layers,
  ArrowRight
} from "lucide-react";

interface SessionData {
  id: string;
  workspaceId: string;
  agentName: string;
  goal: string;
  status: string;
  metadata?: Record<string, unknown>;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function SessionOverviewPage({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [headHash, setHeadHash] = useState("0".repeat(64));
  const [approvalsCount, setApprovalsCount] = useState(0);
  const [filesCount, setFilesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const [sessRes, apprRes, filesRes] = await Promise.all([
          fetch(`/api/agentledger/sessions/${params.id}`),
          fetch(`/api/agentledger/sessions/${params.id}/approvals`),
          fetch(`/api/agentledger/sessions/${params.id}/files`)
        ]);

        if (sessRes.ok) {
          const d = await sessRes.json();
          setSession(d.session);
          setEventCount(d.eventCount || 0);
          setHeadHash(d.headHash || "0".repeat(64));
        }

        if (apprRes.ok) {
          const a = await apprRes.json();
          setApprovalsCount(a.total || 0);
        }

        if (filesRes.ok) {
          const f = await filesRes.json();
          setFilesCount(f.total || 0);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, [params.id]);

  if (loading) {
    return (
      <div className="text-zinc-500 text-sm py-12 text-center">Loading session overview...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-purple-400" /> Agent Identity
            </span>
            <p className="text-base font-semibold text-white">{session?.agentName}</p>
            <p className="text-[11px] text-zinc-500 font-mono">Workspace: {session?.workspaceId}</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" /> Event Count
            </span>
            <p className="text-base font-semibold text-white">{eventCount} Chained Events</p>
            <p className="text-[11px] text-zinc-500 font-mono">Tamper-evident log</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Approval Gates
            </span>
            <p className="text-base font-semibold text-white">{approvalsCount} Total Decisions</p>
            <p className="text-[11px] text-zinc-500 font-mono">Human-in-the-loop audit</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-emerald-400" /> File Modifications
            </span>
            <p className="text-base font-semibold text-white">{filesCount} Changed Files</p>
            <p className="text-[11px] text-zinc-500 font-mono">Cryptographic digests</p>
          </CardContent>
        </Card>
      </div>

      {/* Goal & Cryptographic Seal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3 border-b border-zinc-800/80">
            <CardTitle className="text-base">Session Goal & Specifications</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm text-zinc-200 leading-relaxed">{session?.goal}</p>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono text-zinc-400 pt-2 border-t border-zinc-800/60">
              <div>
                <span className="text-zinc-500">Created:</span>{" "}
                {session?.createdAt ? new Date(session.createdAt).toLocaleString() : "N/A"}
              </div>
              <div>
                <span className="text-zinc-500">Started:</span>{" "}
                {session?.startedAt ? new Date(session.startedAt).toLocaleString() : "Pending"}
              </div>
              <div>
                <span className="text-zinc-500">Completed:</span>{" "}
                {session?.completedAt
                  ? new Date(session.completedAt).toLocaleString()
                  : "In progress"}
              </div>
              <div>
                <span className="text-zinc-500">Status:</span>{" "}
                <span className="text-purple-300 uppercase">{session?.status}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3 border-b border-zinc-800/80">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Cryptographic Integrity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-xs space-y-1">
              <span className="text-zinc-500 block text-[10px] uppercase">
                Chain Head Hash (SHA-256)
              </span>
              <span className="text-purple-400 break-all">{headHash}</span>
            </div>

            <p className="text-xs text-zinc-400">
              Every tool call, approval decision, and file change is canonically serialized
              according to RFC 8785 JSON Canonicalization Scheme (JCS) and linked in a continuous
              hash-chain.
            </p>

            <div className="pt-2">
              <Link href={`/sessions/${params.id}/export`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-zinc-700 text-zinc-300"
                >
                  Inspect Export Bundle <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href={`/sessions/${params.id}/timeline`} className="group">
          <Card className="bg-zinc-900/40 border-zinc-800 hover:border-purple-600/60 transition-colors">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-white group-hover:text-purple-300 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-400" /> Forensic Timeline
                </span>
                <p className="text-xs text-zinc-400">
                  Inspect full chronological event stream with provenance and payloads.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href={`/sessions/${params.id}/replay`} className="group">
          <Card className="bg-zinc-900/40 border-zinc-800 hover:border-cyan-600/60 transition-colors">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-white group-hover:text-cyan-300 flex items-center gap-2">
                  <Play className="w-4 h-4 text-cyan-400" /> Session Replay Player
                </span>
                <p className="text-xs text-zinc-400">
                  Step forward and backward through recorded history without executing tools.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href={`/sessions/${params.id}/approvals`} className="group">
          <Card className="bg-zinc-900/40 border-zinc-800 hover:border-amber-600/60 transition-colors">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-white group-hover:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Human Approval Gates
                </span>
                <p className="text-xs text-zinc-400">
                  Review pending approval requests and inspect decision audit trail.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
