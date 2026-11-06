import { test, expect } from "@playwright/test";
import path from "node:path";

test.describe("Phase 4.5 & 5.5 — Complete Cross-Application Governance Journey", () => {
  test("executes 15-step comprehensive audit journey: incident, quality, graph, session, policy simulation, approval denial, replay, signed export, and verify", async ({
    page
  }) => {
    test.setTimeout(90000);

    // -------------------------------------------------------------
    // Step 1: Create a TraceVault incident
    // -------------------------------------------------------------
    await page.goto("http://localhost:3001/incidents/new");
    await expect(
      page.locator("h1, h2, h3").filter({ hasText: "Create New Incident" })
    ).toBeVisible();

    await page.fill('input[placeholder*="Production Database"]', "Phase 4.5 Governance Incident");
    await page.fill(
      'textarea[placeholder*="Briefly describe"]',
      "Cross-application audit verifying policy engine and evidence graph"
    );
    await page.selectOption("select >> nth=0", "critical");
    await page.selectOption("select >> nth=1", "open");
    await page.click('button:has-text("Create Incident")');

    await page.waitForURL(/\/incidents\/case_/);
    await expect(page.locator("text=Phase 4.5 Governance Incident")).toBeVisible();

    // -------------------------------------------------------------
    // Step 2: Import evidence
    // -------------------------------------------------------------
    await page.click('a:has-text("Evidence & Sources")');
    const fixturePath = path.resolve(
      __dirname,
      "../fixtures/tracevault/sample-incident/application-events.jsonl"
    );
    await page.setInputFiles('input[type="file"]', fixturePath);
    await expect(page.locator("text=Pre-Ingestion Validation Preview")).toBeVisible({
      timeout: 10000
    });
    await page.click('button:has-text("Confirm & Ingest 5 Events")');
    await expect(page.locator("text=Successfully ingested 5 events")).toBeVisible({
      timeout: 10000
    });

    // -------------------------------------------------------------
    // Step 3: Inspect its quality report
    // -------------------------------------------------------------
    await page.click('a:has-text("Quality Audit")');
    await expect(page.locator("text=Evidence Quality & Completeness Audit")).toBeVisible();
    await expect(page.locator("text=COMPLETENESS SCORE")).toBeVisible();
    await expect(page.locator("text=Source Evidence Coverage")).toBeVisible();
    await expect(
      page.locator("text=Forensic Notice: Completeness Assessment vs. Truthfulness")
    ).toBeVisible();

    // -------------------------------------------------------------
    // Step 4: Open Unified Evidence Graph
    // -------------------------------------------------------------
    await page.click('a:has-text("Evidence Graph")');
    await page.waitForURL(/\/graph/);
    await expect(page.locator("text=Unified Evidence Graph")).toBeVisible();
    await expect(page.locator("text=Causality Disclaimers:")).toBeVisible();
    await expect(page.locator("text=Explicit Provenance Only")).toBeVisible();

    // -------------------------------------------------------------
    // Step 5: Navigate to related AgentLedger evidence
    // -------------------------------------------------------------
    await page.goto("http://localhost:3002/");
    await expect(page.locator("header")).toContainText("AgentLedger");
    await expect(page.locator("text=Total Sessions")).toBeVisible();

    // -------------------------------------------------------------
    // Step 6: Create an agent session via wizard
    // -------------------------------------------------------------
    await page.goto("http://localhost:3002/sessions/new");
    await expect(page.locator("text=Create Agent Audit Session")).toBeVisible();
    await page.click("text=Security Policy Auditor");
    await page.click('button:has-text("Create Audit Session")');
    await page.waitForURL(/\/sessions\/session_/);
    await expect(page.locator("main")).toContainText("session_");

    // -------------------------------------------------------------
    // Step 7: Simulate a policy decision in Policy Simulator
    // -------------------------------------------------------------
    await page.goto("http://localhost:3002/policies");
    await expect(page.locator("text=Policy Intelligence Engine")).toBeVisible();
    await expect(page.locator("text=Live Policy Simulator")).toBeVisible();

    // Click preset for Protected Config Edit
    await page.click("text=Protected Config Edit (REQUIRE_APPROVAL)");
    await page.click('button:has-text("Simulate Decision")');

    await expect(page.locator("text=Decision:")).toBeVisible();
    await expect(page.locator("text=REQUIRE_APPROVAL").first()).toBeVisible();
    await expect(page.locator("text=Explainable Reason:")).toBeVisible();

    // -------------------------------------------------------------
    // Step 8, 9, 10: Run demo audit, request approval, deny an action
    // -------------------------------------------------------------
    await page.goto("http://localhost:3002/");
    await page.click("text=Launch Controlled Demo");

    // Wait for demo to run
    await page.waitForURL(/\/sessions\/.*\/timeline/, { timeout: 40000 });
    await expect(page.locator("text=agent.session.created").first()).toBeVisible();
    await expect(page.locator("text=agent.approval.decided").first()).toBeVisible();

    // -------------------------------------------------------------
    // Step 11: Verify zero mutation in Approvals tab
    // -------------------------------------------------------------
    await page.click('a:has-text("Approvals")');
    await page.waitForURL(/\/sessions\/.*\/approvals/);
    await expect(page.locator("text=Human Approval & Denial Gates")).toBeVisible();
    await expect(page.locator("text=rejected").first()).toBeVisible();

    // -------------------------------------------------------------
    // Step 12: Inspect audit history and deterministic replay
    // -------------------------------------------------------------
    await page.click('a:has-text("Replay")');
    await page.waitForURL(/\/sessions\/.*\/replay/);
    await expect(page.locator("text=Deterministic Forensic Replay")).toBeVisible();
    await expect(page.locator("text=Step 1 of")).toBeVisible();
    await page.click("button[title='Next Step']");
    await expect(page.locator("text=Step 2 of")).toBeVisible();

    // -------------------------------------------------------------
    // Step 13: Export a signed evidence bundle
    // -------------------------------------------------------------
    await page.click('a:has-text("Export")');
    await page.waitForURL(/\/sessions\/.*\/export/);
    await expect(page.locator("text=EvidenceKit Portable Export Bundle")).toBeVisible();
    await expect(page.locator("text=Download Bundle JSON")).toBeVisible();

    // Download the signed bundle
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('a:has-text("Download Bundle JSON")')
    ]);
    const exportedBundlePath = path.resolve(
      __dirname,
      "../fixtures/agentledger/exported-signed-bundle.json"
    );
    await download.saveAs(exportedBundlePath);

    // -------------------------------------------------------------
    // Step 14: Verify signed bundle independently on /verify
    // -------------------------------------------------------------
    await page.goto("http://localhost:3002/verify");
    await expect(page.locator("text=Independent Evidence Verifier")).toBeVisible();
    await page.setInputFiles('input[type="file"]', exportedBundlePath);
    await page.click('button:has-text("Verify Bundle Integrity")');

    await expect(page.locator("text=CRYPTOGRAPHIC INTEGRITY VERIFIED")).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator("text=Ed25519 Signed & Verified")).toBeVisible();
    await expect(page.locator("text=SIGNATURE NOTICE:")).toBeVisible();

    // -------------------------------------------------------------
    // Step 15: Tamper with bundle and confirm rejection
    // -------------------------------------------------------------
    const tamperedPath = path.resolve(
      __dirname,
      "../fixtures/tracevault/tampered-bundle/bundle.json"
    );
    await page.setInputFiles('input[type="file"]', tamperedPath);
    await page.click('button:has-text("Verify Bundle Integrity")');

    await expect(page.locator("text=VERIFICATION FAILED: TAMPERING DETECTED")).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator("text=Defect & Inconsistency Diagnostics:")).toBeVisible();
  });
});
