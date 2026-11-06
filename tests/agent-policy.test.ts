import { describe, it, expect } from "vitest";
import {
  DEFAULT_AGENT_POLICY,
  evaluateAgentPolicy,
  matchesPathPattern,
  AgentPolicy
} from "@evidencekit/core";
import {
  defaultAgentPolicyService,
  defaultAgentSandboxService,
  defaultChainService
} from "@evidencekit/evidence-server";

describe("Phase 4.5 — AgentLedger Deterministic Policy Engine Test Suite", () => {
  const testWorkspace = `ws_pol_${Date.now()}`;
  const testSession = `sess_pol_${Date.now()}`;

  it("evaluates ALLOW for read-only sandboxed operations", () => {
    const result = evaluateAgentPolicy(DEFAULT_AGENT_POLICY, {
      workspaceId: testWorkspace,
      sessionId: testSession,
      agentName: "policy-auditor",
      toolName: "read_file",
      operation: "read",
      path: "src/config.ts"
    });

    expect(result.decision).toBe("ALLOW");
    expect(result.matchedRuleId).toBe("rule_allow_safe_read");
    expect(result.approvalRequired).toBe(false);
    expect(result.riskLevel).toBe("low");
    expect(result.reason).toContain("Read operations inside the verified sandbox are permitted");
  });

  it("evaluates REQUIRE_APPROVAL for protected security configurations", () => {
    const result = evaluateAgentPolicy(DEFAULT_AGENT_POLICY, {
      workspaceId: testWorkspace,
      sessionId: testSession,
      agentName: "policy-auditor",
      toolName: "modify_file",
      operation: "write",
      path: "src/protected-config.ts"
    });

    expect(result.decision).toBe("REQUIRE_APPROVAL");
    expect(result.matchedRuleId).toBe("rule_require_approval_security_config");
    expect(result.approvalRequired).toBe(true);
    expect(result.riskLevel).toBe("high");
    expect(result.reason).toContain("PROTECTED_RESOURCE");
  });

  it("evaluates DENY for prohibited shell execution and secret files", () => {
    // 1. Prohibited shell execution
    const shellResult = evaluateAgentPolicy(DEFAULT_AGENT_POLICY, {
      workspaceId: testWorkspace,
      sessionId: testSession,
      agentName: "adversarial-agent",
      toolName: "shell_command",
      operation: "execute"
    });
    expect(shellResult.decision).toBe("DENY");
    expect(shellResult.matchedRuleId).toBe("rule_deny_shell");
    expect(shellResult.riskLevel).toBe("critical");
    expect(shellResult.reason).toContain("UNAUTHORIZED_TOOL_CLASS");

    // 2. Secret file access (.env)
    const envResult = evaluateAgentPolicy(DEFAULT_AGENT_POLICY, {
      workspaceId: testWorkspace,
      sessionId: testSession,
      agentName: "adversarial-agent",
      toolName: "modify_file",
      operation: "write",
      path: ".env.production"
    });
    expect(envResult.decision).toBe("DENY");
    expect(envResult.matchedRuleId).toBe("rule_deny_env_secrets");
    expect(envResult.riskLevel).toBe("critical");
  });

  it("evaluates rule precedence correctly (DENY takes precedence over general allow)", () => {
    const customPolicy: AgentPolicy = {
      id: "pol_precedence_test",
      version: "1.0.0",
      workspaceId: testWorkspace,
      name: "Precedence Test Policy",
      description: "Testing rule priority ordering",
      defaultDecision: "REQUIRE_APPROVAL",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rules: [
        {
          id: "rule_low_priority_allow",
          name: "General Allow Write",
          tool: "modify_file",
          operation: "write",
          action: "ALLOW",
          riskLevel: "medium",
          reason: "General write allow",
          precedence: 50
        },
        {
          id: "rule_high_priority_deny",
          name: "Deny System Config",
          tool: "modify_file",
          operation: "write",
          pathPattern: "*system*",
          action: "DENY",
          riskLevel: "critical",
          reason: "System config is denied",
          precedence: 10 // Lower number = evaluated first
        }
      ]
    };

    const res = evaluateAgentPolicy(customPolicy, {
      workspaceId: testWorkspace,
      sessionId: testSession,
      agentName: "tester",
      toolName: "modify_file",
      operation: "write",
      path: "config/system.json"
    });

    expect(res.decision).toBe("DENY");
    expect(res.matchedRuleId).toBe("rule_high_priority_deny");
  });

  it("matches path patterns including wildcards and negations", () => {
    expect(matchesPathPattern("src/protected-config.ts", "*protected*")).toBe(true);
    expect(matchesPathPattern("src/config.ts", "*protected*")).toBe(false);
    expect(matchesPathPattern(".env.production", "*.env*")).toBe(true);
    expect(matchesPathPattern("src/index.ts", "!*protected*")).toBe(true);
    expect(matchesPathPattern("src/protected.ts", "!*protected*")).toBe(false);
  });

  it("simulates hypothetical tool calls without executing them or recording events", () => {
    const simSession = `sim_${Date.now()}`;
    const initialEvents = defaultChainService.getEventsInMemory(simSession);
    expect(initialEvents.length).toBe(0);

    const simulation = defaultAgentPolicyService.simulatePolicy({
      workspaceId: testWorkspace,
      sessionId: simSession,
      agentName: "simulator-bot",
      toolName: "modify_file",
      path: "src/protected-config.ts"
    });

    expect(simulation.decision).toBe("REQUIRE_APPROVAL");
    expect(simulation.approvalRequired).toBe(true);
    expect(simulation.matchedRuleId).toBe("rule_require_approval_security_config");

    // Verify zero events appended to event ledger during simulation
    const postSimEvents = defaultChainService.getEventsInMemory(simSession);
    expect(postSimEvents.length).toBe(0);
  });

  it("preserves policy versions and prevents retroactive mutation of historical versions", () => {
    const v1 = defaultAgentPolicyService.getActivePolicy(testWorkspace);
    expect(v1.version).toBe("1.0.0");

    // Register v1.1.0 with additional rule
    const v2 = defaultAgentPolicyService.savePolicyVersion(testWorkspace, {
      version: "1.1.0",
      workspaceId: testWorkspace,
      name: "Updated Governance Policy",
      description: "Added custom security rules",
      defaultDecision: "DENY",
      rules: [
        ...v1.rules,
        {
          id: "rule_deny_migrations",
          name: "Deny Migration Edits",
          tool: "modify_file",
          operation: "write",
          pathPattern: "*migrations*",
          action: "DENY",
          riskLevel: "critical",
          reason: "Database migrations are locked",
          precedence: 5
        }
      ]
    });

    expect(v2.version).toBe("1.1.0");

    // Verify history contains both v1.0.0 and v1.1.0
    const history = defaultAgentPolicyService.getPolicyHistory(testWorkspace);
    expect(history.length).toBe(2);
    expect(history[0]?.version).toBe("1.0.0");
    expect(history[1]?.version).toBe("1.1.0");

    // Active policy is now v1.1.0
    const active = defaultAgentPolicyService.getActivePolicy(testWorkspace);
    expect(active.version).toBe("1.1.0");
    expect(active.defaultDecision).toBe("DENY");
  });

  it("evaluates and records immutable agent.policy.evaluated event into the hash chain on execution", async () => {
    const execSession = `exec_pol_${Date.now()}`;
    defaultAgentSandboxService.initSandbox(execSession);

    // Safe execution
    const execRes = await defaultAgentSandboxService.executeTool({
      sessionId: execSession,
      agentName: "audited-worker",
      toolName: "read_file",
      args: { path: "README.md" },
      workspaceId: testWorkspace
    });

    expect(execRes.success).toBe(true);

    // Retrieve stream events
    const streamEvents = defaultChainService.getEventsInMemory(execSession);
    const policyEvaluatedEvent = streamEvents.find(
      (e) => e.event.event_name === "agent.policy.evaluated"
    );

    expect(policyEvaluatedEvent).toBeDefined();
    expect(policyEvaluatedEvent?.event.attributes.decision).toBe("ALLOW");
    expect(policyEvaluatedEvent?.event.attributes.matched_rule_id).toBe("rule_allow_safe_read");
    expect(policyEvaluatedEvent?.event.attributes.risk_level).toBe("low");

    // Verify hash-chain integrity
    const verification = defaultChainService.verifyInMemory(execSession);
    expect(verification.status).toBe("verified");
  });
});
