export interface ToolCallContext {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  requiresApproval?: boolean;
}

export interface ApprovalDecision {
  toolCallId: string;
  decision: "approved" | "rejected";
  actorId: string;
  reason?: string;
}

export interface FileDiffMetadata {
  path: string;
  oldSha256?: string;
  newSha256: string;
  diffSummary?: string;
}
