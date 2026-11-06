import { randomUUID } from "node:crypto";
import {
  AgentPolicy,
  DEFAULT_AGENT_POLICY,
  PolicyEvaluationRequest,
  PolicyEvaluationResult,
  evaluateAgentPolicy,
  EvidenceEvent,
  sanitizeData
} from "@evidencekit/core";
import { DbClient } from "@evidencekit/db";
import { defaultChainService } from "./chain-service";

export class AgentPolicyService {
  private policies: Map<string, AgentPolicy[]> = new Map();

  constructor() {
    // Seed default policy for default workspace
    this.policies.set("default", [{ ...DEFAULT_AGENT_POLICY }]);
  }

  /**
   * Retrieves the latest active policy for a given workspace.
   */
  public getActivePolicy(workspaceId: string): AgentPolicy {
    const list = this.policies.get(workspaceId);
    if (!list || list.length === 0) {
      return { ...DEFAULT_AGENT_POLICY, workspaceId };
    }
    return list[list.length - 1]!;
  }

  /**
   * Retrieves all policy versions for auditability.
   */
  public getPolicyHistory(workspaceId: string): AgentPolicy[] {
    const list = this.policies.get(workspaceId);
    if (!list || list.length === 0) {
      return [{ ...DEFAULT_AGENT_POLICY, workspaceId }];
    }
    return [...list];
  }

  /**
   * Registers a new policy version for a workspace. Historical versions are preserved.
   */
  public savePolicyVersion(
    workspaceId: string,
    policyData: Omit<AgentPolicy, "id" | "createdAt" | "updatedAt">
  ): AgentPolicy {
    const existingList = this.policies.get(workspaceId) || [
      { ...DEFAULT_AGENT_POLICY, workspaceId }
    ];
    const now = new Date().toISOString();

    const newVersion: AgentPolicy = {
      ...policyData,
      id: `pol_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      workspaceId,
      createdAt: now,
      updatedAt: now
    };

    existingList.push(newVersion);
    this.policies.set(workspaceId, existingList);
    return newVersion;
  }

  /**
   * Simulates policy evaluation for hypothetical actions without executing tools or appending events.
   */
  public simulatePolicy(request: PolicyEvaluationRequest): PolicyEvaluationResult {
    const policy = this.getActivePolicy(request.workspaceId);
    const inferredOp = this.inferOperation(request.toolName, request.operation);
    return evaluateAgentPolicy(policy, {
      ...request,
      operation: inferredOp
    });
  }

  /**
   * Evaluates a requested action against active policy on the server and appends an immutable
   * agent.policy.evaluated event to the session event stream.
   */
  public async evaluateAndRecord(
    request: PolicyEvaluationRequest,
    db?: DbClient
  ): Promise<PolicyEvaluationResult> {
    const policy = this.getActivePolicy(request.workspaceId);
    const inferredOp = this.inferOperation(request.toolName, request.operation);
    const result = evaluateAgentPolicy(policy, {
      ...request,
      operation: inferredOp
    });

    // Record immutable audit event
    const now = new Date().toISOString();
    const sanitizedArgs = request.args
      ? (sanitizeData(request.args).sanitized as Record<string, unknown>)
      : {};

    const policyEvent: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: request.sessionId,
      event_name: "agent.policy.evaluated",
      occurred_at: now,
      observed_at: now,
      time_confidence: "source_timestamp",
      source: {
        system: "agent-governance-engine",
        adapter: "policy-evaluator",
        adapter_version: "1.0.0"
      },
      actor: { type: "agent", id: request.agentName },
      severity:
        result.decision === "DENY"
          ? "critical"
          : result.decision === "REQUIRE_APPROVAL"
            ? "warning"
            : "info",
      correlation_ids: [result.matchedRuleId],
      attributes: {
        tool_name: request.toolName,
        operation: inferredOp,
        target_path: request.path,
        decision: result.decision,
        matched_rule_id: result.matchedRuleId,
        matched_rule_name: result.matchedRuleName,
        policy_id: result.policyId,
        policy_version: result.policyVersion,
        risk_level: result.riskLevel,
        reason: result.reason,
        approval_required: result.approvalRequired,
        arguments: sanitizedArgs
      }
    };

    try {
      if (db) {
        await defaultChainService.appendTransactional(policyEvent, db);
      } else {
        defaultChainService.appendInMemory(policyEvent);
      }
    } catch {
      defaultChainService.appendInMemory(policyEvent);
    }

    return result;
  }

  private inferOperation(toolName: string, explicitOp?: string): string {
    if (explicitOp) return explicitOp;
    const lower = toolName.toLowerCase();
    if (lower === "read_file" || lower === "list_files" || lower === "calculate_file_hash") {
      return "read";
    }
    if (lower === "create_file" || lower === "modify_file") {
      return "write";
    }
    if (lower.includes("delete")) {
      return "delete";
    }
    if (lower.includes("exec") || lower.includes("shell") || lower.includes("command")) {
      return "execute";
    }
    return "execute";
  }
}

export const defaultAgentPolicyService = new AgentPolicyService();
