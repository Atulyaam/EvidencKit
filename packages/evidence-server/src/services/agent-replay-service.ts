import { ChainedEvent, verifyEventChain } from "@evidencekit/core";

export interface ReplayToolCallState {
  toolCallId: string;
  toolName: string;
  status: "started" | "awaiting_approval" | "approved" | "rejected" | "completed" | "failed";
  arguments?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

export interface ReplayApprovalState {
  approvalId?: string;
  toolCallId: string;
  decision: "pending" | "approved" | "rejected";
  actorId?: string;
  reason?: string;
}

export interface ReplayFileState {
  path: string;
  operation: "create" | "modify" | "delete";
  oldSha256?: string | null;
  newSha256: string;
  diffSummary?: string;
  updatedAt: string;
}

export interface ReplayStepState {
  stepIndex: number;
  totalSteps: number;
  currentEvent: ChainedEvent;
  sessionStatus: string;
  toolCalls: Record<string, ReplayToolCallState>;
  approvals: Record<string, ReplayApprovalState>;
  files: Record<string, ReplayFileState>;
  isVerified: boolean;
  cumulativeDurationMs: number;
}

export class AgentReplayService {
  /**
   * Reconstructs recorded session history step-by-step from persisted events.
   * Pure deterministic reconstruction: DOES NOT execute tools or modify filesystem.
   */
  public buildReplayHistory(events: ChainedEvent[]): ReplayStepState[] {
    if (!events || events.length === 0) {
      return [];
    }

    // Sort by occurred_at ASC, tie-breaking by stream_sequence
    const sorted = [...events].sort((a, b) => {
      const tA = a.event.occurred_at ? new Date(a.event.occurred_at).getTime() : 0;
      const tB = b.event.occurred_at ? new Date(b.event.occurred_at).getTime() : 0;
      if (tA !== tB) return tA - tB;
      return a.stream_sequence - b.stream_sequence;
    });

    const chainVerification = verifyEventChain(events);
    const isChainValid = chainVerification.status === "verified";

    const steps: ReplayStepState[] = [];
    let currentSessionStatus = "created";
    const toolCalls: Record<string, ReplayToolCallState> = {};
    const approvals: Record<string, ReplayApprovalState> = {};
    const files: Record<string, ReplayFileState> = {};
    let cumulativeDurationMs = 0;

    for (let i = 0; i < sorted.length; i++) {
      const chained = sorted[i]!;
      const ev = chained.event;
      const attrs = (ev.attributes || {}) as Record<string, unknown>;

      switch (ev.event_name) {
        case "agent.session.created":
          currentSessionStatus = "created";
          break;

        case "agent.run.started":
          currentSessionStatus = "running";
          break;

        case "agent.tool.started": {
          const tcId = String(
            attrs.tool_call_id || chained.event.correlation_ids?.[0] || `tc_${i}`
          );
          const toolName = String(attrs.tool_name || "unknown");
          const args = (attrs.arguments as Record<string, unknown>) || {};
          const reqApproval = Boolean(attrs.requires_approval);

          toolCalls[tcId] = {
            toolCallId: tcId,
            toolName,
            status: reqApproval ? "awaiting_approval" : "started",
            arguments: args
          };
          break;
        }

        case "agent.approval.requested": {
          const tcId = String(attrs.tool_call_id || chained.event.correlation_ids?.[0] || "");
          const apprId = String(attrs.approval_id || `appr_${i}`);
          currentSessionStatus = "awaiting_approval";
          approvals[tcId] = {
            approvalId: apprId,
            toolCallId: tcId,
            decision: "pending"
          };
          if (toolCalls[tcId]) {
            toolCalls[tcId]!.status = "awaiting_approval";
          }
          break;
        }

        case "agent.approval.decided": {
          const tcId = String(attrs.tool_call_id || chained.event.correlation_ids?.[0] || "");
          const decision = String(attrs.decision || "approved") as "approved" | "rejected";
          const actorId = String(attrs.actor_id || "reviewer");
          const reason = attrs.reason ? String(attrs.reason) : undefined;
          currentSessionStatus = "running";

          approvals[tcId] = {
            ...(approvals[tcId] || { toolCallId: tcId }),
            decision,
            actorId,
            reason
          };

          if (toolCalls[tcId]) {
            toolCalls[tcId]!.status = decision === "approved" ? "approved" : "rejected";
          }
          break;
        }

        case "agent.tool.completed": {
          const tcId = String(attrs.tool_call_id || chained.event.correlation_ids?.[0] || "");
          const output = (attrs.output as Record<string, unknown>) || {};
          const dur = Number(attrs.duration_ms || 0);
          cumulativeDurationMs += dur;

          if (toolCalls[tcId]) {
            toolCalls[tcId]!.status = "completed";
            toolCalls[tcId]!.output = output;
            toolCalls[tcId]!.durationMs = dur;
          }
          break;
        }

        case "agent.tool.failed": {
          const tcId = String(attrs.tool_call_id || chained.event.correlation_ids?.[0] || "");
          const error = String(attrs.error || "Failed");

          if (toolCalls[tcId]) {
            toolCalls[tcId]!.status = "failed";
            toolCalls[tcId]!.error = error;
          }
          break;
        }

        case "agent.file.changed": {
          const targetPath = String(attrs.path || "unknown");
          const op = String(attrs.operation || "modify") as "create" | "modify" | "delete";
          const oldSha = attrs.old_sha256 ? String(attrs.old_sha256) : null;
          const newSha = String(attrs.new_sha256 || "");
          const diffSummary = attrs.diff_summary ? String(attrs.diff_summary) : undefined;

          files[targetPath] = {
            path: targetPath,
            operation: op,
            oldSha256: oldSha,
            newSha256: newSha,
            diffSummary,
            updatedAt: ev.occurred_at || new Date().toISOString()
          };
          break;
        }

        case "agent.run.completed":
          currentSessionStatus = "completed";
          break;

        case "agent.run.failed":
          currentSessionStatus = "failed";
          break;
      }

      // Snapshot state at step i (clone objects so each step is independent)
      steps.push({
        stepIndex: i + 1,
        totalSteps: sorted.length,
        currentEvent: chained,
        sessionStatus: currentSessionStatus,
        toolCalls: JSON.parse(JSON.stringify(toolCalls)),
        approvals: JSON.parse(JSON.stringify(approvals)),
        files: JSON.parse(JSON.stringify(files)),
        isVerified: isChainValid,
        cumulativeDurationMs
      });
    }

    return steps;
  }
}

export const defaultAgentReplayService = new AgentReplayService();
