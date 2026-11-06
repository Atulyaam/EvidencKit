"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input } from "@evidencekit/ui";
import { AlertTriangle, CheckCircle, XCircle, Clock, UserCheck } from "lucide-react";

interface ApprovalItem {
  id: string;
  sessionId: string;
  toolCallId: string;
  toolName: string;
  operation?: string | null;
  arguments?: Record<string, unknown> | null;
  decision: "pending" | "approved" | "rejected";
  actorId: string;
  reason?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
}

export default function SessionApprovalsPage({ params }: { params: { id: string } }) {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [reasonInputs, setReasonInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const loadApprovals = async () => {
    try {
      const res = await fetch(`/api/agentledger/sessions/${params.id}/approvals`);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [params.id]);

  const handleDecision = async (approvalId: string, decision: "approved" | "rejected") => {
    setDecidingId(approvalId);
    setError(null);
    const reason = reasonInputs[approvalId] || "";

    try {
      const res = await fetch(`/api/agentledger/sessions/${params.id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId,
          decision,
          reason:
            reason ||
            (decision === "approved" ? "Approved by human reviewer" : "Rejected by human reviewer")
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Decision failed");
      }

      await loadApprovals();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDecidingId(null);
    }
  };

  const pendingList = approvals.filter((a) => a.decision === "pending");
  const pastList = approvals.filter((a) => a.decision !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" /> Human Approval & Denial Gates
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Review sensitive tool operations requested by the agent. Decisions are cryptographically
            recorded in the EvidenceKit stream.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadApprovals}
          className="text-xs border-zinc-700 hover:bg-zinc-800 text-zinc-300"
        >
          Refresh Approvals
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Pending Approvals Section */}
      <Card className="bg-zinc-900/60 border-zinc-800 shadow-xl">
        <CardHeader className="pb-3 border-b border-zinc-800 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-300">
            <Clock className="w-4 h-4 text-amber-400" /> Awaiting Human Decision (
            {pendingList.length})
          </CardTitle>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
            Interactive Gates
          </span>
        </CardHeader>

        <CardContent className="p-5">
          {loading ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              Loading pending approvals...
            </div>
          ) : pendingList.length === 0 ? (
            <div className="py-8 text-center text-zinc-400 text-xs space-y-1">
              <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p>No pending approval requests for this session.</p>
              <p className="text-zinc-500">
                The agent is either running permitted tools or has completed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingList.map((appr) => (
                <div
                  key={appr.id}
                  className="p-5 rounded-xl bg-zinc-950 border border-amber-800/60 space-y-4 font-mono text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400 font-bold">{appr.id}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-200 font-semibold">Tool: {appr.toolName}</span>
                    </div>
                    <Badge
                      variant="warning"
                      className="text-[10px] uppercase font-mono px-2 py-0.5 w-fit"
                    >
                      PENDING REVIEW
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-zinc-400 text-[11px] uppercase">
                      Requested Operation:
                    </span>
                    <p className="text-sm font-sans text-zinc-100 font-medium">
                      {appr.operation || "Sensitive file modification"}
                    </p>
                  </div>

                  {appr.arguments && (
                    <div className="space-y-1">
                      <span className="text-zinc-400 text-[11px] uppercase">
                        Arguments Payload:
                      </span>
                      <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 overflow-x-auto max-h-40 whitespace-pre-wrap font-mono">
                        {JSON.stringify(appr.arguments, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Decision Controls */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <Input
                      type="text"
                      placeholder="Optional decision rationale or justification..."
                      value={reasonInputs[appr.id] || ""}
                      onChange={(e) =>
                        setReasonInputs({ ...reasonInputs, [appr.id]: e.target.value })
                      }
                      className="bg-zinc-900 border-zinc-700 text-xs flex-1 h-9"
                    />

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={decidingId === appr.id}
                        onClick={() => handleDecision(appr.id, "approved")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 px-4 flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve Action
                      </Button>
                      <Button
                        size="sm"
                        disabled={decidingId === appr.id}
                        onClick={() => handleDecision(appr.id, "rejected")}
                        className="bg-red-600 hover:bg-red-500 text-white text-xs h-9 px-4 flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Deny Action
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Decisions History */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3 border-b border-zinc-800">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-cyan-400" /> Decision History Audit Trail (
            {pastList.length})
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {pastList.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">No completed decisions yet.</div>
          ) : (
            <div className="divide-y divide-zinc-800/60 font-mono text-xs">
              {pastList.map((appr) => (
                <div
                  key={appr.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400 font-semibold">{appr.id}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-300">Tool: {appr.toolName}</span>
                      <Badge
                        variant={appr.decision === "approved" ? "success" : "danger"}
                        className="text-[10px] uppercase px-2 py-0.5"
                      >
                        {appr.decision}
                      </Badge>
                    </div>

                    <p className="text-sm font-sans text-zinc-200">{appr.operation}</p>
                    {appr.reason && (
                      <p className="text-xs text-zinc-400 font-sans italic">
                        Rationale: &quot;{appr.reason}&quot;
                      </p>
                    )}
                  </div>

                  <div className="text-[11px] text-zinc-500 text-right shrink-0">
                    <div>
                      Decided by: <strong className="text-zinc-300">{appr.actorId}</strong>
                    </div>
                    <div>{appr.decidedAt ? new Date(appr.decidedAt).toLocaleString() : "N/A"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
