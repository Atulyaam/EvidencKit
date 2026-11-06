import { z } from "zod";

export const PolicyDecisionSchema = z.enum(["ALLOW", "REQUIRE_APPROVAL", "DENY"]);
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const PolicyRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tool: z.string().default("*"), // tool name or "*"
  operation: z.string().default("*"), // "read", "write", "delete", "execute", or "*"
  pathPattern: z.string().optional(), // glob or substring pattern
  riskLevel: RiskLevelSchema.default("medium"),
  action: PolicyDecisionSchema,
  reason: z.string(),
  precedence: z.number().default(100) // Lower number = higher priority
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const AgentPolicySchema = z.object({
  id: z.string(),
  version: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string(),
  defaultDecision: PolicyDecisionSchema.default("REQUIRE_APPROVAL"),
  rules: z.array(PolicyRuleSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type AgentPolicy = z.infer<typeof AgentPolicySchema>;

export const PolicyEvaluationRequestSchema = z.object({
  workspaceId: z.string(),
  sessionId: z.string(),
  agentName: z.string(),
  toolName: z.string(),
  operation: z.string().optional(),
  path: z.string().optional(),
  args: z.record(z.unknown()).optional()
});
export type PolicyEvaluationRequest = z.infer<typeof PolicyEvaluationRequestSchema>;

export const PolicyEvaluationResultSchema = z.object({
  decision: PolicyDecisionSchema,
  matchedRuleId: z.string(),
  matchedRuleName: z.string(),
  policyId: z.string(),
  policyVersion: z.string(),
  reason: z.string(),
  riskLevel: RiskLevelSchema,
  requestedAction: z.object({
    toolName: z.string(),
    operation: z.string().optional(),
    path: z.string().optional()
  }),
  approvalRequired: z.boolean(),
  evaluatedAt: z.string()
});
export type PolicyEvaluationResult = z.infer<typeof PolicyEvaluationResultSchema>;

/**
 * Standard default policy for AgentLedger workspaces.
 */
export const DEFAULT_AGENT_POLICY: AgentPolicy = {
  id: "pol_default_v1",
  version: "1.0.0",
  workspaceId: "default",
  name: "EvidenceKit Strict Agent Governance Policy",
  description:
    "Default governance policy enforcing read allowlists, human-in-the-loop approvals on protected configs, and absolute denial of arbitrary shell commands.",
  defaultDecision: "REQUIRE_APPROVAL",
  createdAt: "2026-11-06T00:00:00.000Z",
  updatedAt: "2026-11-06T00:00:00.000Z",
  rules: [
    {
      id: "rule_deny_shell",
      name: "Deny Arbitrary Shell Execution",
      description: "Arbitrary shell or command execution is categorically prohibited.",
      tool: "shell_command",
      operation: "*",
      riskLevel: "critical",
      action: "DENY",
      reason:
        "UNAUTHORIZED_TOOL_CLASS: Arbitrary shell execution is prohibited by security policy.",
      precedence: 10
    },
    {
      id: "rule_deny_raw_exec",
      name: "Deny System Exec Calls",
      description: "Direct system execution tools are blocked unconditionally.",
      tool: "exec",
      operation: "*",
      riskLevel: "critical",
      action: "DENY",
      reason: "UNAUTHORIZED_TOOL_CLASS: Direct exec tools are blocked unconditionally.",
      precedence: 11
    },
    {
      id: "rule_deny_env_secrets",
      name: "Deny Secret Files",
      description: "Writing or reading environment secrets and credentials.",
      tool: "*",
      operation: "*",
      pathPattern: "*.env*",
      riskLevel: "critical",
      action: "DENY",
      reason: "SENSITIVE_RESOURCE: Direct access to environment secret files is denied.",
      precedence: 20
    },
    {
      id: "rule_require_approval_security_config",
      name: "Require Approval for Security Configurations",
      description:
        "Modifying security policies or protected service configurations requires owner authorization.",
      tool: "modify_file",
      operation: "write",
      pathPattern: "*protected*",
      riskLevel: "high",
      action: "REQUIRE_APPROVAL",
      reason:
        "PROTECTED_RESOURCE: Modifications to protected configuration files require explicit human authorization.",
      precedence: 30
    },
    {
      id: "rule_require_approval_create_security",
      name: "Require Approval for New Security Files",
      description: "Creating new files in protected directories.",
      tool: "create_file",
      operation: "write",
      pathPattern: "*protected*",
      riskLevel: "high",
      action: "REQUIRE_APPROVAL",
      reason: "PROTECTED_RESOURCE: Creating protected files requires human approval.",
      precedence: 31
    },
    {
      id: "rule_allow_safe_read",
      name: "Allow Read-Only Operations",
      description: "Reading files and computing hashes within sandbox.",
      tool: "read_file",
      operation: "read",
      riskLevel: "low",
      action: "ALLOW",
      reason: "READ_ONLY: Read operations inside the verified sandbox are permitted.",
      precedence: 50
    },
    {
      id: "rule_allow_list_files",
      name: "Allow Directory Listing",
      description: "Listing files inside sandbox.",
      tool: "list_files",
      operation: "read",
      riskLevel: "low",
      action: "ALLOW",
      reason: "READ_ONLY: File directory inspection within the sandbox is permitted.",
      precedence: 51
    },
    {
      id: "rule_allow_calculate_hash",
      name: "Allow Checksum Calculations",
      description: "Computing SHA-256 hashes of sandbox files.",
      tool: "calculate_file_hash",
      operation: "read",
      riskLevel: "low",
      action: "ALLOW",
      reason: "READ_ONLY: SHA-256 cryptographic hash computation is permitted.",
      precedence: 52
    },
    {
      id: "rule_allow_unprotected_file_edits",
      name: "Allow General Workspace Modifications",
      description: "Standard modifications to non-protected files.",
      tool: "modify_file",
      operation: "write",
      pathPattern: "!*protected*",
      riskLevel: "medium",
      action: "ALLOW",
      reason:
        "SANDBOX_WRITE: Edits to non-protected files within the sandbox boundary are permitted.",
      precedence: 70
    },
    {
      id: "rule_allow_unprotected_file_create",
      name: "Allow General File Creation",
      description: "Creating non-protected files.",
      tool: "create_file",
      operation: "write",
      pathPattern: "!*protected*",
      riskLevel: "medium",
      action: "ALLOW",
      reason: "SANDBOX_WRITE: Creating non-protected files inside the sandbox is permitted.",
      precedence: 71
    }
  ]
};

/**
 * Checks whether a path string matches a pattern (supports wildcards * and negated !patterns).
 */
export function matchesPathPattern(targetPath: string, pattern?: string): boolean {
  if (!pattern || pattern === "*") return true;

  const normalizedTarget = targetPath.toLowerCase().replace(/\\/g, "/");
  const isNegated = pattern.startsWith("!");
  const effectivePattern = (isNegated ? pattern.slice(1) : pattern)
    .toLowerCase()
    .replace(/\\/g, "/");

  // Simple wildcard matching
  const regexStr = effectivePattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  const regex = new RegExp(`^${regexStr}$|${regexStr.replace(/^\.\*/, "").replace(/\.\*$/, "")}`);

  const matches =
    regex.test(normalizedTarget) || normalizedTarget.includes(effectivePattern.replace(/\*/g, ""));
  return isNegated ? !matches : matches;
}

/**
 * Pure evaluation function that executes a policy against a requested action deterministically.
 */
export function evaluateAgentPolicy(
  policy: AgentPolicy,
  request: PolicyEvaluationRequest
): PolicyEvaluationResult {
  const evaluatedAt = new Date().toISOString();
  const reqTool = request.toolName.toLowerCase();
  const reqOp = (request.operation || "").toLowerCase();
  const reqPath = request.path || "";

  // Sort rules by precedence (lowest number first)
  const sortedRules = [...policy.rules].sort(
    (a, b) => (a.precedence ?? 100) - (b.precedence ?? 100)
  );

  for (const rule of sortedRules) {
    // 1. Tool match
    if (rule.tool !== "*" && rule.tool.toLowerCase() !== reqTool) {
      continue;
    }

    // 2. Operation match
    if (rule.operation !== "*" && reqOp && rule.operation.toLowerCase() !== reqOp) {
      continue;
    }

    // 3. Path pattern match
    if (rule.pathPattern) {
      if (!reqPath || !matchesPathPattern(reqPath, rule.pathPattern)) {
        continue;
      }
    }

    // Match found!
    return {
      decision: rule.action,
      matchedRuleId: rule.id,
      matchedRuleName: rule.name,
      policyId: policy.id,
      policyVersion: policy.version,
      reason: rule.reason,
      riskLevel: rule.riskLevel,
      requestedAction: {
        toolName: request.toolName,
        operation: request.operation,
        path: request.path
      },
      approvalRequired: rule.action === "REQUIRE_APPROVAL",
      evaluatedAt
    };
  }

  // Fallback to default policy decision
  return {
    decision: policy.defaultDecision,
    matchedRuleId: "default_fallback",
    matchedRuleName: "Default Policy Fallback",
    policyId: policy.id,
    policyVersion: policy.version,
    reason: `DEFAULT_DECISION: No specific rule matched. Applying default decision '${policy.defaultDecision}'.`,
    riskLevel:
      policy.defaultDecision === "DENY"
        ? "critical"
        : policy.defaultDecision === "REQUIRE_APPROVAL"
          ? "high"
          : "low",
    requestedAction: {
      toolName: request.toolName,
      operation: request.operation,
      path: request.path
    },
    approvalRequired: policy.defaultDecision === "REQUIRE_APPROVAL",
    evaluatedAt
  };
}
