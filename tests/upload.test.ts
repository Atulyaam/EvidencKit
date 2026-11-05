import { describe, it, expect, beforeEach } from "vitest";
import JSZip from "jszip";
import {
  EvidenceUploadService,
  SessionContext,
  defaultChainService
} from "@evidencekit/evidence-server";

describe("Phase 3 — Task 3.3, 3.4 & 3.5: Evidence Upload & Ingestion System", () => {
  let uploadService: EvidenceUploadService;
  const ownerContext: SessionContext = {
    userId: "owner-user",
    role: "owner",
    isOwner: true,
    isJudgeMode: false
  };

  const judgeContext: SessionContext = {
    role: "judge",
    isOwner: false,
    isJudgeMode: true
  };

  beforeEach(() => {
    uploadService = new EvidenceUploadService();
  });

  it("previews and imports JSONL application logs", async () => {
    const streamId = "case_upload_test_logs";
    const logData = [
      JSON.stringify({
        timestamp: "2026-11-16T10:00:00.000Z",
        level: "error",
        message: "Connection pool exhausted",
        trace_id: "trace-909"
      }),
      JSON.stringify({
        timestamp: "2026-11-16T10:00:05.000Z",
        level: "info",
        message: "Worker thread restarted"
      })
    ].join("\n");

    const buffer = Buffer.from(logData, "utf8");

    // Preview
    const preview = await uploadService.previewUpload("application.log", buffer);
    expect(preview.sourceType).toBe("application_logs");
    expect(preview.totalRecordsDetected).toBe(2);
    expect(preview.artifactDigest).toBeDefined();

    // Import
    const result = await uploadService.importUpload(
      streamId,
      "application.log",
      buffer,
      ownerContext
    );
    expect(result.recordsAccepted).toBe(2);
    expect(result.totalStreamEvents).toBe(2);
    expect(result.chainHeadHash).toMatch(/^[0-9a-f]{64}$/);

    // Verify chain integrity
    const verification = defaultChainService.verifyInMemory(streamId);
    expect(verification.status).toBe("verified");
  });

  it("previews and imports Git commit history JSON", async () => {
    const streamId = "case_upload_test_git";
    const commits = [
      {
        sha: "deadbeef01",
        author: "Lead Architect",
        email: "architect@company.com",
        timestamp: "2026-11-16T09:30:00.000Z",
        message: "feat(db): update migration schema"
      }
    ];
    const buffer = Buffer.from(JSON.stringify(commits), "utf8");

    const preview = await uploadService.previewUpload("git-history.json", buffer);
    expect(preview.sourceType).toBe("git_history");
    expect(preview.totalRecordsDetected).toBe(1);

    const result = await uploadService.importUpload(
      streamId,
      "git-history.json",
      buffer,
      ownerContext
    );
    expect(result.recordsAccepted).toBe(1);
  });

  it("previews and imports CI execution records", async () => {
    const streamId = "case_upload_test_ci";
    const ciRecords = [
      {
        job_id: "ci-job-881",
        workflow_name: "Staging Pipeline",
        status: "failure",
        started_at: "2026-11-16T09:40:00.000Z",
        completed_at: "2026-11-16T09:42:00.000Z",
        commit_sha: "deadbeef01"
      }
    ];
    const buffer = Buffer.from(JSON.stringify(ciRecords), "utf8");

    const preview = await uploadService.previewUpload("ci-events.json", buffer);
    expect(preview.sourceType).toBe("ci_pipeline");

    const result = await uploadService.importUpload(
      streamId,
      "ci-events.json",
      buffer,
      ownerContext
    );
    expect(result.recordsAccepted).toBe(1);
  });

  it("previews and imports Deployment JSON records", async () => {
    const streamId = "case_upload_test_dep";
    const deployments = [
      {
        deployment_id: "dep-772",
        environment: "production",
        service: "payment-api",
        commit_sha: "deadbeef01",
        status: "failed",
        timestamp: "2026-11-16T09:45:00.000Z"
      }
    ];
    const buffer = Buffer.from(JSON.stringify(deployments), "utf8");

    const preview = await uploadService.previewUpload("deployments.json", buffer);
    expect(preview.sourceType).toBe("deployments");

    const result = await uploadService.importUpload(
      streamId,
      "deployments.json",
      buffer,
      ownerContext
    );
    expect(result.recordsAccepted).toBe(1);
  });

  it("safely processes a multi-source incident ZIP bundle", async () => {
    const streamId = "case_upload_test_zip";
    const zip = new JSZip();

    zip.file("application.log", JSON.stringify({ level: "error", message: "Out of memory" }));
    zip.file(
      "deployments.json",
      JSON.stringify([
        {
          deployment_id: "dep-1",
          environment: "prod",
          service: "auth",
          commit_sha: "c1",
          status: "completed",
          timestamp: "2026-11-16T10:00:00Z"
        }
      ])
    );

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const preview = await uploadService.previewUpload("incident-bundle.zip", zipBuffer);
    expect(preview.sourceType).toBe("zip_bundle");
    expect(preview.archiveEntries?.length).toBe(2);

    const result = await uploadService.importUpload(
      streamId,
      "incident-bundle.zip",
      zipBuffer,
      ownerContext
    );
    expect(result.recordsAccepted).toBe(2);

    const verification = defaultChainService.verifyInMemory(streamId);
    expect(verification.status).toBe("verified");
  });

  it("SECURITY: detects and blocks ZIP-Slip path traversal patterns", async () => {
    expect(EvidenceUploadService.validateSafeZipPath("../../etc/passwd")).toBe(false);
    expect(EvidenceUploadService.validateSafeZipPath("..\\Windows\\win.ini")).toBe(false);
    expect(EvidenceUploadService.validateSafeZipPath("/etc/shadow")).toBe(false);
    expect(EvidenceUploadService.validateSafeZipPath("C:\\autoexec.bat")).toBe(false);
    expect(EvidenceUploadService.validateSafeZipPath("safe-folder/logs.jsonl")).toBe(true);
  });

  it("SECURITY: rejects corrupt or invalid ZIP files", async () => {
    const corruptBuffer = Buffer.from("PK\x03\x04corrupted-archive-garbage-bytes", "utf8");
    await expect(uploadService.previewUpload("bad.zip", corruptBuffer)).rejects.toThrow(
      /Corrupted or invalid ZIP archive/
    );
  });

  it("SECURITY: blocks unauthenticated / judge mode import attempts", async () => {
    const buffer = Buffer.from("valid log line\n", "utf8");
    await expect(
      uploadService.importUpload("app.log", "stream-1", buffer, judgeContext)
    ).rejects.toThrow(/Public Judge Mode is strictly READ-ONLY/);
  });
});
