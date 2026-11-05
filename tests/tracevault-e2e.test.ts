import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  defaultIncidentService,
  defaultEvidenceUploadService,
  defaultChainService,
  defaultReportService,
  defaultExportBundleService,
  SessionContext
} from "../packages/evidence-server/src/index";
import { discoverCorrelations } from "../packages/evidence-core/src/index";

describe("Phase 3 — TraceVault End-to-End Incident Reconstruction Lifecycle (Task 3.13)", () => {
  const ownerContext: SessionContext = {
    userId: "lead-incident-commander",
    role: "owner",
    isOwner: true,
    isJudgeMode: false
  };

  it("executes complete lifecycle: creation, multi-source ingestion, chaining, timeline, correlation, reporting, export, and tamper detection", async () => {
    // 1. Create incident
    const incident = await defaultIncidentService.createIncident(
      {
        title: "Production Order Service DB Pool Starvation Outage",
        description:
          "API Gateway reported 502 cascade following deployment of order-service v2.4.1",
        severity: "critical",
        environment: "production"
      },
      ownerContext
    );

    expect(incident.id).toBeDefined();
    expect(incident.status).toBe("open");
    const streamId = incident.id;

    // 2. Load fixtures
    const fixtureDir = path.join(__dirname, "../fixtures/tracevault/sample-incident");
    const gitBytes = fs.readFileSync(path.join(fixtureDir, "git-history.json"));
    const ciBytes = fs.readFileSync(path.join(fixtureDir, "ci-events.json"));
    const depBytes = fs.readFileSync(path.join(fixtureDir, "deployments.json"));
    const appLogBytes = fs.readFileSync(path.join(fixtureDir, "application-events.jsonl"));

    // 3. Ingest Git History
    const gitRes = await defaultEvidenceUploadService.importUpload(
      streamId,
      "git-history.json",
      gitBytes,
      ownerContext
    );
    expect(gitRes.recordsAccepted).toBe(2);

    // 4. Ingest CI Pipeline Events
    const ciRes = await defaultEvidenceUploadService.importUpload(
      streamId,
      "ci-events.json",
      ciBytes,
      ownerContext
    );
    expect(ciRes.recordsAccepted).toBe(1);

    // 5. Ingest Deployment Events
    const depRes = await defaultEvidenceUploadService.importUpload(
      streamId,
      "deployments.json",
      depBytes,
      ownerContext
    );
    expect(depRes.recordsAccepted).toBe(1);

    // 6. Ingest Application JSONL Logs (with sensitive credentials)
    const appRes = await defaultEvidenceUploadService.importUpload(
      streamId,
      "application-events.jsonl",
      appLogBytes,
      ownerContext
    );
    expect(appRes.recordsAccepted).toBe(5);

    // 7. Verify cryptographic hash chain integrity
    const events = defaultChainService.getEventsInMemory(streamId);
    expect(events.length).toBe(9); // 2 git + 1 ci + 1 dep + 5 app

    const verifyResult = defaultChainService.verifyInMemory(streamId);
    expect(verifyResult.status).toBe("verified");
    expect(verifyResult.total_events).toBe(9);
    expect(verifyResult.failed_at_sequence).toBeUndefined();

    // Verify secret redaction occurred before persistence
    const appEvents = events.filter((e) => e.event.source.system === "api-gateway");
    expect(appEvents.length).toBeGreaterThan(0);
    const authHeaderEvent = appEvents.find(
      (e) => (e.event.attributes as any)?.headers?.authorization
    );
    if (authHeaderEvent) {
      const authStr = (authHeaderEvent.event.attributes as any).headers.authorization;
      expect(authStr).not.toContain("secret_jwt_payload");
      expect(authStr).toContain("[REDACTED_");
    }

    // 8. Query Timeline with filters
    const filteredTimeline = defaultChainService.queryTimelineInMemory(streamId, {
      severity: "critical"
    });
    expect(filteredTimeline.events.length).toBeGreaterThan(0);
    expect(filteredTimeline.events.every((e) => e.event.severity === "critical")).toBe(true);

    const searchTimeline = defaultChainService.queryTimelineInMemory(streamId, {
      search: "connection pool"
    });
    expect(searchTimeline.events.length).toBeGreaterThan(0);

    // 9. Discover Candidate Correlations
    const correlations = discoverCorrelations(events, { windowSeconds: 1800 });
    expect(correlations.length).toBeGreaterThanOrEqual(1);

    // Assert rule TV-COR-001 or TV-COR-002 was discovered
    const hasKnownRule = correlations.some(
      (c) => c.rule_id === "TV-COR-001" || c.rule_id === "TV-COR-002" || c.rule_id === "TV-COR-004"
    );
    expect(hasKnownRule).toBe(true);

    // 10. Generate 12-section Investigation Report
    const report = defaultReportService.generateReport(incident, events);
    expect(report.metadata.incidentId).toBe(incident.id);
    expect(report.eventCounts.total).toBe(9);
    expect(report.integrity.status).toBe("verified");
    expect(report.correlations.length).toBeGreaterThanOrEqual(1);

    const markdownReport = defaultReportService.reportToMarkdown(report);
    expect(markdownReport).toContain("# Incident Investigation Report");
    expect(markdownReport).toContain("## 1. Executive Summary");
    expect(markdownReport).toContain("## 7. Cryptographic Chain Verification");
    expect(markdownReport).toContain(report.integrity.head_hash);

    // 11. Export Portable ZIP Evidence Bundle
    const zipBundleBuffer = await defaultExportBundleService.exportBundleZip(streamId);
    expect(Buffer.isBuffer(zipBundleBuffer)).toBe(true);

    // 12. Independent Verification of Exported Bundle
    const independentVerify = await defaultExportBundleService.verifyZipBundle(zipBundleBuffer);
    expect(independentVerify.valid).toBe(true);
    expect(independentVerify.verification.status).toBe("verified");
    expect(independentVerify.manifest.event_count).toBe(9);

    // 13. Tamper Detection using tampered-bundle fixture
    const tamperedBundlePath = path.join(
      __dirname,
      "../fixtures/tracevault/tampered-bundle/bundle.json"
    );
    const tamperedJson = JSON.parse(fs.readFileSync(tamperedBundlePath, "utf-8"));
    const tamperedVerify = defaultExportBundleService.verifyBundle(tamperedJson);

    expect(tamperedVerify.valid).toBe(false);
    expect(tamperedVerify.verification.status).toBe("failed");
    expect(tamperedVerify.verification.failed_at_sequence).toBe(0);
  });
});
