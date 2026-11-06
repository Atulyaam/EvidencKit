import { describe, it, expect, beforeEach } from "vitest";
import { defaultAgentSandboxService } from "../packages/evidence-server/src/index";
import { sanitizeData } from "@evidencekit/core";
import fs from "node:fs";
import path from "node:path";

describe("Phase 4 — Agent Sandbox Security & Tool Execution Suite", () => {
  const sessionId = `test_sbx_${Date.now()}`;
  const sandboxDir = path.resolve(process.cwd(), "fixtures", "agentledger", "sandbox", sessionId);

  beforeEach(() => {
    defaultAgentSandboxService.initSandbox(sessionId);
  });

  it("initializes sandbox with baseline files", () => {
    expect(fs.existsSync(sandboxDir)).toBe(true);
    expect(fs.existsSync(path.join(sandboxDir, "README.md"))).toBe(true);
    expect(fs.existsSync(path.join(sandboxDir, "src", "config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(sandboxDir, "src", "protected-config.ts"))).toBe(true);
  });

  it("identifies protected files that require human approval", () => {
    expect(defaultAgentSandboxService.isProtectedPath("src/protected-config.ts")).toBe(true);
    expect(defaultAgentSandboxService.isProtectedPath(".env.production")).toBe(true);
    expect(defaultAgentSandboxService.isProtectedPath("security-policy.json")).toBe(true);
    expect(defaultAgentSandboxService.isProtectedPath("src/secret.ts")).toBe(true);
    expect(defaultAgentSandboxService.isProtectedPath("src/config.ts")).toBe(false);
    expect(defaultAgentSandboxService.isProtectedPath("README.md")).toBe(false);
  });

  it("strictly enforces tool allowlist and rejects unapproved/dangerous tools", async () => {
    const dangerousTools = [
      "exec",
      "execute_code",
      "shell_cmd",
      "bash",
      "eval",
      "delete_file",
      "curl",
      "spawn"
    ];

    for (const tool of dangerousTools) {
      const res = await defaultAgentSandboxService.executeTool({
        sessionId,
        agentName: "test-agent",
        toolName: tool,
        args: { command: "whoami" }
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not permitted/i);
    }
  });

  it("allows all whitelisted tools to execute safely within sandbox", async () => {
    // 1. list_files
    const listRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName: "test-agent",
      toolName: "list_files",
      args: { directory: "." }
    });
    expect(listRes.success).toBe(true);
    expect(listRes.output).toBeDefined();
    expect(Array.isArray((listRes.output as { files: unknown[] }).files)).toBe(true);

    // 2. create_file
    const createRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName: "test-agent",
      toolName: "create_file",
      args: {
        path: "notes.txt",
        content: "Hello Sandbox"
      }
    });
    expect(createRes.success).toBe(true);
    expect((createRes.output as { operation: string }).operation).toBe("create");
    const initialSha256 = (createRes.output as { newSha256: string }).newSha256;
    expect(initialSha256).toBeDefined();

    // 3. read_file
    const readRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName: "test-agent",
      toolName: "read_file",
      args: { path: "notes.txt" }
    });
    expect(readRes.success).toBe(true);
    expect((readRes.output as { content: string }).content).toBe("Hello Sandbox");

    // 4. calculate_file_hash
    const hashRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName: "test-agent",
      toolName: "calculate_file_hash",
      args: { path: "notes.txt" }
    });
    expect(hashRes.success).toBe(true);
    expect((hashRes.output as { sha256: string }).sha256).toBe(initialSha256);

    // 5. modify_file
    const modRes = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName: "test-agent",
      toolName: "modify_file",
      args: {
        path: "notes.txt",
        content: "Hello Modified Sandbox"
      }
    });
    expect(modRes.success).toBe(true);
    expect((modRes.output as { operation: string }).operation).toBe("modify");
    expect((modRes.output as { newSha256: string }).newSha256).not.toBe(initialSha256);
  });

  it("prevents directory traversal attacks via path parameter manipulation", async () => {
    const traversalPaths = [
      "../outside.txt",
      "../../secret.json",
      "../../../etc/passwd",
      "..\\..\\Windows\\System32\\cmd.exe",
      "src/../../outside.txt",
      "/absolute/path/file.txt",
      "C:\\Windows\\System32\\calc.exe"
    ];

    for (const p of traversalPaths) {
      // Direct path resolution throws
      expect(() => {
        defaultAgentSandboxService.resolveSafePath(p, sessionId);
      }).toThrow(/(Path traversal|outside sandbox|Invalid path)/i);

      // Tool execution fails safely
      const readRes = await defaultAgentSandboxService.executeTool({
        sessionId,
        agentName: "test-agent",
        toolName: "read_file",
        args: { path: p }
      });
      expect(readRes.success).toBe(false);
      expect(readRes.error).toMatch(/(Path traversal|outside sandbox|Invalid path)/i);
    }
  });

  it("sanitizes arguments and redacts sensitive data (tokens, secrets)", () => {
    const sensitivePayload = {
      apiKey: "sk-abcdef12345678901234567890",
      password: "password=supersecretpassword123",
      authorization: "Bearer secret-token-xyz12345",
      nested: {
        api_token: "ghp_abcdef12345678901234567890",
        safeVal: 42
      },
      safeField: "public-info"
    };

    const result = sanitizeData(sensitivePayload);
    const sanitized = result.sanitized as Record<string, unknown>;

    expect(result.redactedCount).toBeGreaterThan(0);
    expect(sanitized.apiKey).toContain("[REDACTED_API_KEY]");
    expect(sanitized.authorization).toContain("[REDACTED_AUTH_TOKEN]");
    expect((sanitized.nested as Record<string, unknown>).api_token).toContain(
      "[REDACTED_GITHUB_TOKEN]"
    );
    expect(sanitized.safeField).toBe("public-info");
  });

  it("generates correct unified diffs on file modification", async () => {
    await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName: "test-agent",
      toolName: "create_file",
      args: {
        path: "diff_test.txt",
        content: "line 1\nline 2\nline 3\n"
      }
    });

    const modResult = await defaultAgentSandboxService.executeTool({
      sessionId,
      agentName: "test-agent",
      toolName: "modify_file",
      args: {
        path: "diff_test.txt",
        content: "line 1\nline 2 modified\nline 3\n"
      }
    });

    expect(modResult.success).toBe(true);
    const diff = (modResult.output as { diffSummary: string }).diffSummary;
    expect(diff).toContain("- line 2");
    expect(diff).toContain("+ line 2 modified");
  });
});
