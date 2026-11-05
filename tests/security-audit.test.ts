import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  EvidenceUploadService,
  defaultIncidentService,
  requireOwnerAuthorization,
  SessionContext
} from "../packages/evidence-server/src/index";
import { sanitizeData } from "../packages/evidence-core/src/index";

describe("Phase 3 — TraceVault Security Audit (Task 3.13)", () => {
  describe("Zip-Slip Path Traversal Protection", () => {
    it("rejects zip entries containing path traversal sequences", () => {
      const maliciousPaths = [
        "../../etc/passwd",
        "..\\..\\windows\\system32\\cmd.exe",
        "foo/../../../bar",
        "/absolute/path/file.txt",
        "C:\\Windows\\System32\\calc.exe",
        "normal/../../traversal.txt"
      ];

      for (const p of maliciousPaths) {
        expect(EvidenceUploadService.validateSafeZipPath(p)).toBe(false);
      }
    });

    it("accepts safe relative zip entry paths", () => {
      const safePaths = [
        "application.log",
        "logs/app.jsonl",
        "git/commits.json",
        "events/ci/pipeline.json"
      ];

      for (const p of safePaths) {
        expect(EvidenceUploadService.validateSafeZipPath(p)).toBe(true);
      }
    });
  });

  describe("Zip-Bomb Resource Protection", () => {
    it("rejects zip archives exceeding maximum entry count", async () => {
      const zip = new JSZip();
      for (let i = 0; i < 205; i++) {
        zip.file(`entry_${i}.txt`, `log line ${i}`);
      }
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

      const ownerContext: SessionContext = {
        userId: "admin",
        role: "owner",
        isOwner: true,
        isJudgeMode: false
      };

      const service = new EvidenceUploadService();
      await expect(
        service.importUpload("test-stream", "bomb.zip", zipBuffer, ownerContext)
      ).rejects.toThrow(/exceeding maximum entry limit/);
    });
  });

  describe("Workspace Isolation & Authorization Enforcement", () => {
    it("prevents cross-workspace incident modification", async () => {
      const tenantAContext: SessionContext = {
        userId: "user-1",
        role: "owner",
        isOwner: true,
        isJudgeMode: false
      };

      const tenantBContext: SessionContext = {
        userId: "user-2",
        role: "owner",
        isOwner: true,
        isJudgeMode: false
      };

      const incident = await defaultIncidentService.createIncident(
        {
          workspaceId: "workspace-alpha",
          title: "Tenant A Private Outage",
          severity: "critical",
          environment: "production"
        },
        tenantAContext
      );

      // Tenant B in workspace-beta attempts to access or mutate Tenant A's incident
      await expect(
        defaultIncidentService.updateIncident(
          incident.id,
          { title: "Hijacked by Tenant B" },
          tenantBContext,
          "workspace-beta"
        )
      ).rejects.toThrow(/not found in workspace 'workspace-beta'/);
    });

    it("enforces read-only behavior for Public Judge Mode", () => {
      const judgeContext: SessionContext = {
        userId: undefined,
        role: "judge",
        isOwner: false,
        isJudgeMode: true
      };

      expect(() => requireOwnerAuthorization(judgeContext)).toThrow(
        /Forbidden: Public Judge Mode is strictly READ-ONLY/
      );
    });
  });

  describe("Pre-Persistence Secret Redaction", () => {
    it("sanitizes JWTs, API tokens, and connection strings before persistence", () => {
      const sensitivePayload = {
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMC6Y5",
        github_token: "ghp_1234567890abcdefghijklmnopqrstuvwxyz",
        postgres_dsn: "postgres://dbuser:super_secret_password_123@db.prod.internal:5432/orders",
        nested: {
          private_key:
            "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----"
        }
      };

      const result = sanitizeData(sensitivePayload);
      const sanitized = result.sanitized as typeof sensitivePayload;

      expect(sanitized.authorization).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(sanitized.postgres_dsn).not.toContain("super_secret_password_123");
      expect(sanitized.postgres_dsn).toContain("[REDACTED_PASSWORD]");
      expect(sanitized.github_token).toContain("[REDACTED_GITHUB_TOKEN]");
      expect(sanitized.nested.private_key).toContain("[REDACTED_PRIVATE_KEY]");
      expect(result.redactedCount).toBeGreaterThanOrEqual(3);
    });
  });
});
