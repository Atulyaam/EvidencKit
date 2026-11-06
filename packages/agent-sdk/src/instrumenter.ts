import { normalizeEvent, EvidenceEvent, sanitizeData } from "@evidencekit/core";
import { ToolCallContext, ApprovalDecision, FileDiffMetadata } from "./types";

export class AgentSessionRecorder {
  public readonly sessionId: string;
  public readonly agentName: string;
  private readonly adapterVersion = "1.0.0";

  constructor(sessionId: string, agentName: string) {
    this.sessionId = sessionId;
    this.agentName = agentName;
  }

  public recordSessionCreated(goal: string, metadata?: Record<string, unknown>): EvidenceEvent {
    const safeGoal = sanitizeData(goal).sanitized;
    const safeMeta = metadata ? sanitizeData(metadata).sanitized : {};
    return normalizeEvent({
      stream_type: "agentledger.session",
      stream_id: this.sessionId,
      event_name: "agent.session.created",
      occurred_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: this.adapterVersion
      },
      actor: {
        type: "agent",
        id: this.agentName
      },
      severity: "info",
      attributes: {
        goal: safeGoal,
        metadata: safeMeta
      }
    });
  }

  public recordRunStarted(): EvidenceEvent {
    return normalizeEvent({
      stream_type: "agentledger.session",
      stream_id: this.sessionId,
      event_name: "agent.run.started",
      occurred_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: this.adapterVersion
      },
      actor: {
        type: "agent",
        id: this.agentName
      },
      severity: "info",
      attributes: {
        status: "running"
      }
    });
  }

  public recordToolStarted(context: ToolCallContext): EvidenceEvent {
    const safeArgs = sanitizeData(context.arguments).sanitized as Record<string, unknown>;
    return normalizeEvent({
      stream_type: "agentledger.session",
      stream_id: this.sessionId,
      event_name: "agent.tool.started",
      occurred_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: this.adapterVersion
      },
      actor: {
        type: "agent",
        id: this.agentName
      },
      severity: "info",
      correlation_ids: [context.toolCallId],
      attributes: {
        tool_call_id: context.toolCallId,
        tool_name: context.toolName,
        arguments: safeArgs,
        requires_approval: context.requiresApproval ?? false
      }
    });
  }

  public recordApprovalRequested(context: ToolCallContext): EvidenceEvent {
    const safeArgs = sanitizeData(context.arguments).sanitized as Record<string, unknown>;
    return normalizeEvent({
      stream_type: "agentledger.session",
      stream_id: this.sessionId,
      event_name: "agent.approval.requested",
      occurred_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: this.adapterVersion
      },
      actor: {
        type: "agent",
        id: this.agentName
      },
      severity: "warning",
      correlation_ids: [context.toolCallId],
      attributes: {
        tool_call_id: context.toolCallId,
        tool_name: context.toolName,
        arguments: safeArgs
      }
    });
  }

  public recordApprovalDecided(decision: ApprovalDecision): EvidenceEvent {
    const safeReason = decision.reason ? sanitizeData(decision.reason).sanitized : null;
    return normalizeEvent({
      stream_type: "agentledger.session",
      stream_id: this.sessionId,
      event_name: "agent.approval.decided",
      occurred_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: this.adapterVersion
      },
      actor: {
        type: "human_reviewer",
        id: decision.actorId
      },
      severity: decision.decision === "approved" ? "info" : "warning",
      correlation_ids: [decision.toolCallId],
      attributes: {
        tool_call_id: decision.toolCallId,
        decision: decision.decision,
        reason: safeReason
      }
    });
  }

  public recordToolCompleted(toolCallId: string, result: Record<string, unknown>): EvidenceEvent {
    const safeResult = sanitizeData(result).sanitized as Record<string, unknown>;
    return normalizeEvent({
      stream_type: "agentledger.session",
      stream_id: this.sessionId,
      event_name: "agent.tool.completed",
      occurred_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: this.adapterVersion
      },
      actor: {
        type: "agent",
        id: this.agentName
      },
      severity: "info",
      correlation_ids: [toolCallId],
      attributes: {
        tool_call_id: toolCallId,
        result: safeResult
      }
    });
  }

  public recordToolFailed(toolCallId: string, error: string): EvidenceEvent {
    const safeError = sanitizeData(error).sanitized as string;
    return normalizeEvent({
      stream_type: "agentledger.session",
      stream_id: this.sessionId,
      event_name: "agent.tool.failed",
      occurred_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: this.adapterVersion
      },
      actor: {
        type: "agent",
        id: this.agentName
      },
      severity: "warning",
      correlation_ids: [toolCallId],
      attributes: {
        tool_call_id: toolCallId,
        error: safeError
      }
    });
  }

  public recordFileChanged(toolCallId: string, fileMeta: FileDiffMetadata): EvidenceEvent {
    return normalizeEvent({
      stream_type: "agentledger.session",
      stream_id: this.sessionId,
      event_name: "agent.file.changed",
      occurred_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: this.adapterVersion
      },
      actor: {
        type: "agent",
        id: this.agentName
      },
      severity: "info",
      correlation_ids: [toolCallId],
      attributes: {
        path: fileMeta.path,
        old_sha256: fileMeta.oldSha256,
        new_sha256: fileMeta.newSha256,
        diff_summary: fileMeta.diffSummary
      }
    });
  }

  public recordRunCompleted(summary: string): EvidenceEvent {
    const safeSummary = sanitizeData(summary).sanitized as string;
    return normalizeEvent({
      stream_type: "agentledger.session",
      stream_id: this.sessionId,
      event_name: "agent.run.completed",
      occurred_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: this.adapterVersion
      },
      actor: {
        type: "agent",
        id: this.agentName
      },
      severity: "info",
      attributes: {
        summary: safeSummary
      }
    });
  }

  public recordRunFailed(error: string): EvidenceEvent {
    const safeError = sanitizeData(error).sanitized as string;
    return normalizeEvent({
      stream_type: "agentledger.session",
      stream_id: this.sessionId,
      event_name: "agent.run.failed",
      occurred_at: new Date().toISOString(),
      time_confidence: "source_timestamp",
      source: {
        system: "agent-runtime",
        adapter: "agent-sdk",
        adapter_version: this.adapterVersion
      },
      actor: {
        type: "agent",
        id: this.agentName
      },
      severity: "critical",
      attributes: {
        error: safeError
      }
    });
  }
}
