# Policy Intelligence Engine Specification

**EvidenceKit & AgentLedger — Advanced Governance**  
**Document Version:** 1.0.0  
**Status:** Approved & Implemented  
**Date:** 2026-11-06

---

## 1. Executive Summary

Autonomous AI agents executing in enterprise workflows introduce severe operational and security risks if their tool executions are unmonitored or unconstrained. The **Policy Intelligence Engine** provides deterministic, version-controlled, explainable governance for agent operations across EvidenceKit and AgentLedger.

Every agent tool call is intercepted by server-side middleware prior to execution. The engine evaluates the proposed action against an active, versioned policy, produces an explainable decision (`ALLOW`, `REQUIRE_APPROVAL`, or `DENY`), logs an immutable audit event (`agent.policy.evaluated`), and enforces hard security boundaries.

---

## 2. Core Architectural Invariants

1. **Deterministic Server-Side Enforcement**: All policy evaluations happen strictly server-side in `AgentSandboxService`. Clients and agents cannot bypass or suppress policy evaluations.
2. **Strict Arbitrary Shell Prohibition**: Arbitrary shell command execution is categorically prohibited. In accordance with EvidenceKit core security principles, no policy rule may authorize arbitrary shell execution.
3. **Immutable Policy Audit Trail**: Every evaluation generates an immutable `agent.policy.evaluated` event in the session's RFC 8785 SHA-256 hash-chain, capturing the requested tool, matched rule, risk level, decision, and rationale.
4. **Explainability by Design**: Every decision includes an explainable rationale detailing exactly which rule matched and why the decision was taken.
5. **No Blind Trust**: Agents cannot approve their own actions or modify active policies without administrative credentials.

---

## 3. Policy Schema & Data Model

The policy system is defined in `@evidencekit/core` via Zod:

```typescript
export const PolicyDecisionSchema = z.enum(["ALLOW", "REQUIRE_APPROVAL", "DENY"]);
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const PolicyRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tool: z.string().default("*"), // Specific tool name or wildcard "*"
  operation: z.string().default("*"), // "read", "write", "delete", "execute", or "*"
  pathPattern: z.string().optional(), // Glob or path pattern, e.g. "**/.env*", "prod/**"
  riskLevel: RiskLevelSchema.default("medium"),
  action: PolicyDecisionSchema,
  reason: z.string(),
  precedence: z.number().default(100) // Lower integer indicates higher evaluation priority
});

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
```

---

## 4. Evaluation Algorithm & Precedence

Evaluation is deterministic and pure (`evaluateAgentPolicy`):

1. **Ordering**: Policy rules are sorted in ascending order of `precedence` (rule with precedence `1` evaluates before precedence `10`).
2. **Matching Criteria**:
   - **Tool Match**: `rule.tool === "*"` OR `rule.tool.toLowerCase() === request.toolName.toLowerCase()`.
   - **Operation Match**: `rule.operation === "*"` OR `rule.operation.toLowerCase() === request.operation.toLowerCase()`.
   - **Path Pattern Match**:
     - If `rule.pathPattern` is defined, the rule **only** matches if `request.path` is provided and satisfies the glob/regex pattern (`matchesPathPattern`). If `request.path` is empty, the rule does not match.
     - If `rule.pathPattern` is undefined, the rule matches regardless of path.
3. **First Match Wins**: The first matching rule dictates the decision (`ALLOW`, `REQUIRE_APPROVAL`, or `DENY`).
4. **Fallback Default**: If no rule matches, the policy's `defaultDecision` (defaulting to `REQUIRE_APPROVAL`) applies.

---

## 5. Default Enterprise Policy Rules

The default enterprise policy (`DEFAULT_AGENT_POLICY`) provides out-of-the-box zero-trust protection:

| Precedence | Rule ID                             | Tool                          | Operation | Path Pattern                | Action             | Risk Level | Rationale                                                             |
| ---------- | ----------------------------------- | ----------------------------- | --------- | --------------------------- | ------------------ | ---------- | --------------------------------------------------------------------- |
| 10         | `rule-deny-secrets`                 | `*`                           | `*`       | `**/.env*`, `**/secrets/**` | `DENY`             | `critical` | Direct access to environment files and secrets is strictly forbidden. |
| 20         | `rule-deny-raw-shell`               | `shell_command`, `exec`       | `*`       | `*`                         | `DENY`             | `critical` | Arbitrary shell execution is forbidden by platform security policy.   |
| 30         | `rule-require-approval-file-write`  | `file_writer`, `fs_write`     | `write`   | `*`                         | `REQUIRE_APPROVAL` | `high`     | Modifying files in the workspace requires human approval.             |
| 40         | `rule-require-approval-file-delete` | `file_remover`, `fs_delete`   | `delete`  | `*`                         | `REQUIRE_APPROVAL` | `critical` | Deleting workspace files requires human authorization.                |
| 50         | `rule-require-approval-git-push`    | `git_push`, `git_commit`      | `execute` | `*`                         | `REQUIRE_APPROVAL` | `high`     | Remote repository mutation requires human approval.                   |
| 60         | `rule-allow-safe-reads`             | `file_reader`, `fs_read`      | `read`    | `*`                         | `ALLOW`            | `low`      | Read-only inspection of permitted workspace files is pre-authorized.  |
| 70         | `rule-allow-git-status`             | `git_status`, `git_diff`      | `read`    | `*`                         | `ALLOW`            | `low`      | Read-only version control queries are pre-authorized.                 |
| 80         | `rule-allow-linter`                 | `run_linter`, `code_analysis` | `read`    | `*`                         | `ALLOW`            | `low`      | Static analysis tools are pre-authorized for autonomous execution.    |

---

## 6. Integration with Agent Sandbox Execution

In `AgentSandboxService.executeTool`:

1. **Tool Allowlist Gate**: Validates whether the tool is in the session's configured tool allowlist.
2. **Policy Intelligence Gate**: Retrieves the workspace policy and evaluates `evaluateAgentPolicy`.
3. **Audit Trail Event**: Appends an `agent.policy.evaluated` event to the stream with:
   - Tool name, path, and sanitized arguments.
   - Matched rule ID and rule name.
   - Decision (`ALLOW`, `REQUIRE_APPROVAL`, `DENY`).
   - Risk level and human-readable explanation.
4. **Enforcement**:
   - If `DENY`: Execution is halted immediately. A `PolicyRejectionError` is thrown and returned to the caller. Zero mutation occurs.
   - If `REQUIRE_APPROVAL`: A pending approval record (`agent_approvals`) and an `agent.approval.requested` event are created. Execution halts until an authorized auditor reviews and decides.
   - If `ALLOW`: Execution proceeds into the sandboxed tool runner, emitting `agent.tool.executed`.

---

## 7. Interactive Policy Simulator UI

Auditors and administrators can test and debug policies interactively via `/policies` in AgentLedger:

- **Preset Test Scenarios**: One-click simulation for Safe Read (`ALLOW`), Protected Config Edit (`REQUIRE_APPROVAL`), and Secret Exfiltration (`DENY`).
- **Interactive Form**: Custom tool name, operation, path, and arguments.
- **Explainable Verdict**: Live badge (`ALLOW`, `REQUIRE_APPROVAL`, `DENY`), matched rule details, precedence rank, risk classification, and actionable reasoning.
- **Rule Hierarchy View**: Complete visualization of all active rules, precedence badges, and filter conditions.

---

## 8. Versioning & Governance Lifecycle

- Every policy modification increments the semantic version (`1.0.0` -> `1.1.0`).
- Historical versions are archived with timestamps and author metadata.
- Sessions lock to the policy version active at session creation time, ensuring historical audit trails remain reproducible and immutable.
