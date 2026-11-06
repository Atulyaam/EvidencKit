import fs from "node:fs";
import path from "node:path";
import crypto, { randomUUID } from "node:crypto";
import { defaultChainService } from "./chain-service";
import { defaultAgentApprovalService } from "./agent-approval-service";
import { defaultAgentPolicyService } from "./agent-policy-service";
import { DbClient } from "@evidencekit/db";
import { EvidenceEvent, sanitizeData } from "@evidencekit/core";

export interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  durationMs: number;
  fileChange?: FileChangeRecord;
}

export interface FileChangeRecord {
  path: string;
  oldSha256: string | null;
  newSha256: string;
  operation: "create" | "modify" | "delete";
  linesAdded: number;
  linesRemoved: number;
  diffSummary: string;
  timestamp: string;
}

export const ALLOWED_TOOLS = [
  "list_files",
  "read_file",
  "create_file",
  "modify_file",
  "calculate_file_hash"
] as const;
export type AllowedToolName = (typeof ALLOWED_TOOLS)[number];

export class AgentSandboxService {
  private baseSandboxDir: string;

  constructor(customSandboxDir?: string) {
    this.baseSandboxDir =
      customSandboxDir || path.resolve(process.cwd(), "fixtures/agentledger/sandbox");
  }

  public getSandboxDir(sessionId?: string): string {
    if (sessionId) {
      return path.resolve(this.baseSandboxDir, sessionId);
    }
    return this.baseSandboxDir;
  }

  /**
   * Initializes the sandbox directory with baseline files for demonstration.
   */
  public initSandbox(sessionId?: string): string {
    const dir = this.getSandboxDir(sessionId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const srcDir = path.join(dir, "src");
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }

    // Baseline README.md
    const readmePath = path.join(dir, "README.md");
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(
        readmePath,
        "# Agent Sandbox Demo Application\n\nSample repository for AgentLedger audit verification.\n",
        "utf8"
      );
    }

    // Safe editable config.ts
    const configPath = path.join(srcDir, "config.ts");
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(
        configPath,
        `export const serviceConfig = {\n  timeoutMs: 5000,\n  retries: 3,\n  logLevel: "info"\n};\n`,
        "utf8"
      );
    }

    // Protected critical security file (mutations require approval)
    const protectedConfigPath = path.join(srcDir, "protected-config.ts");
    if (!fs.existsSync(protectedConfigPath)) {
      fs.writeFileSync(
        protectedConfigPath,
        `export const securityPolicy = {\n  enforceMfa: true,\n  auditLevel: "maximum",\n  zeroTrust: true\n};\n`,
        "utf8"
      );
    }

    return dir;
  }

  /**
   * Safely resolves and validates a target relative path within the sandbox boundary.
   * Throws on path traversal, absolute paths outside sandbox, or symlink escapes.
   */
  public resolveSafePath(
    relPath: string,
    sessionId?: string
  ): { safePath: string; cleanRelPath: string } {
    if (relPath === undefined || relPath === null || typeof relPath !== "string") {
      throw new Error("Invalid path parameter");
    }

    const trimmed = relPath.trim();
    // Allow empty string or "." for sandbox root
    const cleanInput = trimmed === "" ? "." : trimmed;

    // Reject obvious traversal patterns
    if (
      cleanInput.includes("..") ||
      cleanInput.startsWith("/") ||
      /^[a-zA-Z]:\\/.test(cleanInput)
    ) {
      throw new Error(`Path traversal rejected: '${relPath}'`);
    }

    const sandboxRoot = path.resolve(this.initSandbox(sessionId));
    // Normalize path separators
    const normalized = cleanInput === "." ? "" : path.normalize(cleanInput).replace(/^[/\\]+/, "");
    const resolved = normalized === "" ? sandboxRoot : path.resolve(sandboxRoot, normalized);

    if (!resolved.startsWith(sandboxRoot)) {
      throw new Error(`Sandbox boundary violation: path '${relPath}' is outside sandbox`);
    }

    // Check for symlink escapes if the target exists
    if (fs.existsSync(resolved)) {
      const real = fs.realpathSync(resolved);
      if (!real.startsWith(fs.realpathSync(sandboxRoot))) {
        throw new Error(`Symlink escape rejected: '${relPath}' resolves outside sandbox`);
      }
    }

    return { safePath: resolved, cleanRelPath: normalized.replace(/\\/g, "/") };
  }

  /**
   * Evaluates whether an operation on a file requires explicit human approval.
   */
  public isProtectedPath(cleanRelPath: string): boolean {
    const lower = cleanRelPath.toLowerCase();
    return (
      lower.includes("protected") ||
      lower.includes("security") ||
      lower.includes(".env") ||
      lower.endsWith("secret.ts") ||
      lower.includes("production")
    );
  }

  public computeFileHash(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const bytes = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }

  public computeStringHash(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
  }

  private generateDiff(
    oldContent: string,
    newContent: string
  ): { diffSummary: string; linesAdded: number; linesRemoved: number } {
    const oldLines = oldContent ? oldContent.split("\n") : [];
    const newLines = newContent ? newContent.split("\n") : [];

    let linesAdded = 0;
    let linesRemoved = 0;
    const diffSnippets: string[] = [];

    // Simple line-based diff approximation
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    for (const l of oldLines) {
      if (!newSet.has(l)) {
        linesRemoved++;
        if (diffSnippets.length < 10) diffSnippets.push(`- ${l}`);
      }
    }
    for (const l of newLines) {
      if (!oldSet.has(l)) {
        linesAdded++;
        if (diffSnippets.length < 10) diffSnippets.push(`+ ${l}`);
      }
    }

    return {
      diffSummary: diffSnippets.join("\n").slice(0, 1024),
      linesAdded,
      linesRemoved
    };
  }

  /**
   * Executes an allowlisted tool call with policy checks and canonical evidence recording.
   */
  public async executeTool(params: {
    sessionId: string;
    agentName: string;
    toolCallId?: string;
    toolName: string;
    args: Record<string, unknown>;
    approvalId?: string;
    workspaceId?: string;
    db?: DbClient;
  }): Promise<ToolExecutionResult> {
    const { sessionId, agentName, toolName, args, approvalId, workspaceId, db } = params;
    const toolCallId = params.toolCallId || `tc_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const startTime = Date.now();
    this.initSandbox(sessionId);

    // 1. Tool allowlist check
    if (!ALLOWED_TOOLS.includes(toolName as AllowedToolName)) {
      const err = `Tool '${toolName}' is not permitted. Allowlist: ${ALLOWED_TOOLS.join(", ")}`;
      await this.recordToolFailedEvent(sessionId, agentName, toolCallId, toolName, args, err, db);
      return {
        toolCallId,
        toolName,
        success: false,
        error: err,
        durationMs: Date.now() - startTime
      };
    }

    // 2. Server-side policy evaluation
    const cleanPath =
      typeof args.path === "string"
        ? args.path
        : typeof args.directory === "string"
          ? args.directory
          : undefined;
    const policyResult = await defaultAgentPolicyService.evaluateAndRecord(
      {
        workspaceId: workspaceId || "default",
        sessionId,
        agentName,
        toolName,
        path: cleanPath,
        args
      },
      db
    );

    // If policy evaluates to DENY, reject immediately with zero mutation
    if (policyResult.decision === "DENY") {
      const err = `Policy Denied: ${policyResult.reason} (Rule: ${policyResult.matchedRuleId})`;
      await this.recordToolFailedEvent(sessionId, agentName, toolCallId, toolName, args, err, db);
      return {
        toolCallId,
        toolName,
        success: false,
        error: err,
        durationMs: Date.now() - startTime
      };
    }

    // 3. Record tool started event
    await this.recordToolStartedEvent(sessionId, agentName, toolCallId, toolName, args, db);

    try {
      let output: Record<string, unknown> = {};
      let fileChange: FileChangeRecord | undefined;

      switch (toolName) {
        case "list_files": {
          const dirRel = typeof args.directory === "string" ? args.directory : "";
          const { safePath, cleanRelPath } = this.resolveSafePath(dirRel, sessionId);
          if (!fs.existsSync(safePath) || !fs.statSync(safePath).isDirectory()) {
            throw new Error(`Directory does not exist: '${dirRel}'`);
          }

          const entries = fs.readdirSync(safePath, { withFileTypes: true });
          const files = entries.map((e) => ({
            name: e.name,
            isDirectory: e.isDirectory(),
            relativePath: cleanRelPath ? `${cleanRelPath}/${e.name}` : e.name
          }));
          output = { directory: cleanRelPath || "/", files, count: files.length };
          break;
        }

        case "read_file": {
          const targetRel = String(args.path || "");
          const { safePath, cleanRelPath } = this.resolveSafePath(targetRel, sessionId);
          if (!fs.existsSync(safePath)) {
            throw new Error(`File does not exist: '${targetRel}'`);
          }
          const content = fs.readFileSync(safePath, "utf8");
          const sha256 = this.computeFileHash(safePath);
          output = {
            path: cleanRelPath,
            content: content.slice(0, 4096),
            sizeBytes: Buffer.byteLength(content, "utf8"),
            sha256
          };
          break;
        }

        case "calculate_file_hash": {
          const targetRel = String(args.path || "");
          const { safePath, cleanRelPath } = this.resolveSafePath(targetRel, sessionId);
          const sha256 = this.computeFileHash(safePath);
          output = { path: cleanRelPath, sha256 };
          break;
        }

        case "create_file":
        case "modify_file": {
          const targetRel = String(args.path || "");
          const newContent = String(args.content || "");
          const { safePath, cleanRelPath } = this.resolveSafePath(targetRel, sessionId);

          // Policy check: Protected paths or REQUIRE_APPROVAL action require approved approvalId
          const isProtected =
            this.isProtectedPath(cleanRelPath) || policyResult.decision === "REQUIRE_APPROVAL";
          if (isProtected) {
            if (!approvalId) {
              throw new Error(
                `Approval required: Action on protected path '${cleanRelPath}' requires approval before execution (Policy Rule: ${policyResult.matchedRuleId}).`
              );
            }
            const approval = await defaultAgentApprovalService.getApproval(approvalId, db);
            if (
              !approval ||
              approval.decision !== "approved" ||
              approval.toolCallId !== toolCallId
            ) {
              throw new Error(
                `Authorization denied: Approval '${approvalId}' is not in approved state for tool call '${toolCallId}'.`
              );
            }
          }

          const fileExisted = fs.existsSync(safePath);
          const oldContent = fileExisted ? fs.readFileSync(safePath, "utf8") : "";
          const oldSha256 = fileExisted ? this.computeStringHash(oldContent) : null;
          const newSha256 = this.computeStringHash(newContent);

          // Ensure parent dir exists
          const parentDir = path.dirname(safePath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }

          // Write file
          fs.writeFileSync(safePath, newContent, "utf8");

          const diff = this.generateDiff(oldContent, newContent);
          const changeRecord: FileChangeRecord = {
            path: cleanRelPath,
            oldSha256,
            newSha256,
            operation: fileExisted ? "modify" : "create",
            linesAdded: diff.linesAdded,
            linesRemoved: diff.linesRemoved,
            diffSummary: diff.diffSummary,
            timestamp: new Date().toISOString()
          };

          fileChange = changeRecord;
          output = {
            path: cleanRelPath,
            operation: changeRecord.operation,
            oldSha256,
            newSha256,
            linesAdded: diff.linesAdded,
            linesRemoved: diff.linesRemoved,
            diffSummary: diff.diffSummary
          };

          // Record canonical file changed event
          await this.recordFileChangedEvent(sessionId, agentName, toolCallId, changeRecord, db);
          break;
        }
      }

      const durationMs = Date.now() - startTime;
      await this.recordToolCompletedEvent(
        sessionId,
        agentName,
        toolCallId,
        toolName,
        output,
        durationMs,
        db
      );

      return {
        toolCallId,
        toolName,
        success: true,
        output,
        durationMs,
        fileChange
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errMsg = err?.message || "Execution error";
      await this.recordToolFailedEvent(
        sessionId,
        agentName,
        toolCallId,
        toolName,
        args,
        errMsg,
        db
      );
      return {
        toolCallId,
        toolName,
        success: false,
        error: errMsg,
        durationMs
      };
    }
  }

  private async recordToolStartedEvent(
    sessionId: string,
    agentName: string,
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
    db?: DbClient
  ) {
    const now = new Date().toISOString();
    const redactedArgs = sanitizeData(args).sanitized as Record<string, unknown>;
    const ev: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: sessionId,
      event_name: "agent.tool.started",
      occurred_at: now,
      observed_at: now,
      time_confidence: "source_timestamp",
      source: { system: "agent-runtime", adapter: "agent-sdk", adapter_version: "1.0.0" },
      actor: { type: "agent", id: agentName },
      severity: "info",
      correlation_ids: [toolCallId],
      attributes: {
        tool_call_id: toolCallId,
        tool_name: toolName,
        arguments: redactedArgs
      }
    };
    try {
      if (db) await defaultChainService.appendTransactional(ev, db);
      else defaultChainService.appendInMemory(ev);
    } catch {
      defaultChainService.appendInMemory(ev);
    }
  }

  private async recordToolCompletedEvent(
    sessionId: string,
    agentName: string,
    toolCallId: string,
    toolName: string,
    output: Record<string, unknown>,
    durationMs: number,
    db?: DbClient
  ) {
    const now = new Date().toISOString();
    const redactedOutput = sanitizeData(output).sanitized as Record<string, unknown>;
    const ev: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: sessionId,
      event_name: "agent.tool.completed",
      occurred_at: now,
      observed_at: now,
      time_confidence: "source_timestamp",
      source: { system: "agent-runtime", adapter: "agent-sdk", adapter_version: "1.0.0" },
      actor: { type: "agent", id: agentName },
      severity: "info",
      correlation_ids: [toolCallId],
      attributes: {
        tool_call_id: toolCallId,
        tool_name: toolName,
        duration_ms: durationMs,
        output: redactedOutput
      }
    };
    try {
      if (db) await defaultChainService.appendTransactional(ev, db);
      else defaultChainService.appendInMemory(ev);
    } catch {
      defaultChainService.appendInMemory(ev);
    }
  }

  private async recordToolFailedEvent(
    sessionId: string,
    agentName: string,
    toolCallId: string,
    toolName: string,
    _args: Record<string, unknown>,
    error: string,
    db?: DbClient
  ) {
    const now = new Date().toISOString();
    const ev: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: sessionId,
      event_name: "agent.tool.failed",
      occurred_at: now,
      observed_at: now,
      time_confidence: "source_timestamp",
      source: { system: "agent-runtime", adapter: "agent-sdk", adapter_version: "1.0.0" },
      actor: { type: "agent", id: agentName },
      severity: "warning",
      correlation_ids: [toolCallId],
      attributes: {
        tool_call_id: toolCallId,
        tool_name: toolName,
        error
      }
    };
    try {
      if (db) await defaultChainService.appendTransactional(ev, db);
      else defaultChainService.appendInMemory(ev);
    } catch {
      defaultChainService.appendInMemory(ev);
    }
  }

  private async recordFileChangedEvent(
    sessionId: string,
    agentName: string,
    toolCallId: string,
    change: FileChangeRecord,
    db?: DbClient
  ) {
    const now = new Date().toISOString();
    const ev: EvidenceEvent = {
      schema_version: "1.0",
      event_id: randomUUID(),
      stream_type: "agentledger.session",
      stream_id: sessionId,
      event_name: "agent.file.changed",
      occurred_at: now,
      observed_at: now,
      time_confidence: "source_timestamp",
      source: { system: "agent-runtime", adapter: "agent-sdk", adapter_version: "1.0.0" },
      actor: { type: "agent", id: agentName },
      severity: "info",
      correlation_ids: [toolCallId],
      attributes: {
        tool_call_id: toolCallId,
        path: change.path,
        operation: change.operation,
        old_sha256: change.oldSha256,
        new_sha256: change.newSha256,
        lines_added: change.linesAdded,
        lines_removed: change.linesRemoved,
        diff_summary: change.diffSummary
      }
    };
    try {
      if (db) await defaultChainService.appendTransactional(ev, db);
      else defaultChainService.appendInMemory(ev);
    } catch {
      defaultChainService.appendInMemory(ev);
    }
  }
}

export const defaultAgentSandboxService = new AgentSandboxService();
