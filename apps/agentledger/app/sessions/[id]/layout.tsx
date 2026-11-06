"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge, Button } from "@evidencekit/ui";
import {
  History,
  Play,
  AlertTriangle,
  FileCode,
  Download,
  Info,
  ShieldCheck,
  Pause,
  XCircle,
  PlayCircle
} from "lucide-react";

interface SessionData {
  id: string;
  workspaceId: string;
  agentName: string;
  goal: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function SessionDetailLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [headHash, setHeadHash] = useState<string>("0".repeat(64));
  const [eventCount, setEventCount] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState(false);

  const loadSession = async () => {
    try {
      const res = await fetch(`/api/agentledger/sessions/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setHeadHash(data.headHash || "0".repeat(64));
        setEventCount(data.eventCount || 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSession();
  }, [params.id, pathname]);

  const handleAction = async (action: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/agentledger/sessions/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        await loadSession();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunDemo = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/agentledger/sessions/${params.id}/demo/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        await loadSession();
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const tabs = [
    { name: "Overview", href: `/sessions/${params.id}`, icon: Info },
    { name: "Timeline", href: `/sessions/${params.id}/timeline`, icon: History },
    { name: "Replay", href: `/sessions/${params.id}/replay`, icon: Play },
    { name: "Approvals", href: `/sessions/${params.id}/approvals`, icon: AlertTriangle },
    { name: "Files", href: `/sessions/${params.id}/files`, icon: FileCode },
    { name: "Export", href: `/sessions/${params.id}/export`, icon: Download }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Session Top Bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm font-bold text-purple-400">
                {session?.id || params.id}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-sm font-semibold text-zinc-200">
                {session?.agentName || "Agent"}
              </span>
              {session && (
                <Badge
                  variant={
                    session.status === "completed"
                      ? "success"
                      : session.status === "running"
                        ? "default"
                        : session.status === "awaiting_approval"
                          ? "warning"
                          : "outline"
                  }
                  className="text-[10px] uppercase font-mono px-2 py-0.5"
                >
                  {session.status.replace("_", " ")}
                </Badge>
              )}
            </div>

            <p className="text-xs text-zinc-300 max-w-3xl line-clamp-1">
              {session?.goal || "Loading session goal..."}
            </p>

            <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500 pt-0.5">
              <span>Events: {eventCount}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-purple-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Head: {headHash.slice(0, 12)}...{headHash.slice(-6)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {session?.status === "created" && (
              <Button
                size="sm"
                onClick={() => handleAction("start")}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
              >
                <PlayCircle className="w-3.5 h-3.5 mr-1" /> Start Run
              </Button>
            )}

            {session?.status === "running" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction("pause")}
                disabled={actionLoading}
                className="border-zinc-700 text-xs h-8 text-zinc-300"
              >
                <Pause className="w-3.5 h-3.5 mr-1" /> Pause
              </Button>
            )}

            {session?.status === "paused" && (
              <Button
                size="sm"
                onClick={() => handleAction("start")}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
              >
                <Play className="w-3.5 h-3.5 mr-1" /> Resume
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleRunDemo}
              disabled={actionLoading}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-8"
            >
              <Play className="w-3.5 h-3.5 mr-1 fill-current" />
              {actionLoading ? "Processing..." : "Run Demo Audit"}
            </Button>

            {session?.status !== "completed" && session?.status !== "cancelled" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction("cancel")}
                disabled={actionLoading}
                className="border-zinc-800 text-xs h-8 text-zinc-400 hover:text-red-400"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Sub-nav Tabs */}
        <div className="max-w-7xl mx-auto flex items-center gap-1 mt-4 overflow-x-auto border-t border-zinc-800/80 pt-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-purple-950/80 text-purple-300 border border-purple-800/60"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-purple-400" : "text-zinc-500"}`} />
                {tab.name}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full p-6">{children}</div>
    </div>
  );
}
