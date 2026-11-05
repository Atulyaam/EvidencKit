import { test, expect } from "@playwright/test";
import path from "node:path";

test.describe("TraceVault Forensic Reconstruction — Complete User Journey", () => {
  test("loads landing dashboard, metrics, and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/TraceVault/);

    // Verify Brand Header
    await expect(page.locator("header")).toContainText("TraceVault");
    await expect(page.locator("header")).toContainText("Public Judge Mode");

    // Verify Dashboard Cards
    await expect(page.locator("text=Total Incidents")).toBeVisible();
    await expect(page.locator("text=Cryptographic Integrity")).toBeVisible();
    await expect(page.locator(".text-2xl:has-text('SHA-256')")).toBeVisible();
  });

  test("executes end-to-end incident lifecycle: create, upload, timeline, correlations, report, and tamper verification", async ({
    page
  }) => {
    page.on("console", (msg) => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`[BROWSER ERROR] ${err.message}\n${err.stack}`));

    // 1. Navigate to Create Incident
    await page.goto("/incidents/new");
    await expect(
      page.locator("h1, h2, h3").filter({ hasText: "Create New Incident" })
    ).toBeVisible();

    // 2. Fill Incident Form
    await page.fill(
      'input[placeholder*="Production Database"]',
      "Playwright Automated Test Incident"
    );
    await page.fill(
      'textarea[placeholder*="Briefly describe"]',
      "Automated browser validation testing DB starvation and 502 cascade"
    );
    await page.selectOption("select >> nth=0", "critical");
    await page.selectOption("select >> nth=1", "open");
    await page.fill('input[placeholder="production"]', "production");

    // 3. Submit
    await page.click('button:has-text("Create Incident")');

    // Wait for redirect to incident page
    await page.waitForURL(/\/incidents\/case_/);
    await expect(page.locator("text=Playwright Automated Test Incident")).toBeVisible();
    await expect(page.locator("text=Stream: case_")).toBeVisible();

    // 4. Navigate to Evidence & Sources tab
    await page.click('a:has-text("Evidence & Sources")');
    await expect(page.locator("text=Upload & Ingest Evidence Sources")).toBeVisible();

    // 5. Upload application-events.jsonl fixture
    const fixturePath = path.resolve(
      __dirname,
      "../fixtures/tracevault/sample-incident/application-events.jsonl"
    );
    await page.setInputFiles('input[type="file"]', fixturePath);

    // 6. Verify Pre-Ingestion Validation Preview
    await expect(page.locator("text=Pre-Ingestion Validation Preview")).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator("text=5 Valid")).toBeVisible();

    // 7. Confirm and Ingest
    await page.click('button:has-text("Confirm & Ingest 5 Events")');
    await expect(page.locator("text=Successfully ingested 5 events into hash chain")).toBeVisible({
      timeout: 10000
    });

    // 8. Navigate to Forensic Timeline
    await page.click('a:has-text("Forensic Timeline")');
    await expect(page.locator("text=Forensic Event Stream")).toBeVisible();
    await expect(page.locator("text=event(s) shown")).toBeVisible();

    // 9. Inspect Provenance & Hash Inspector
    // Click on the first event in the timeline
    await page.locator(".cursor-pointer").first().click();
    await expect(page.locator("text=Hash-Chain Verification")).toBeVisible();
    await expect(page.locator("text=Source Provenance")).toBeVisible();
    await expect(page.locator("text=Previous Hash:")).toBeVisible();
    await expect(page.locator("text=Event Hash:")).toBeVisible();

    // 10. Navigate to Investigation Report & Correlations
    await page.click('a:has-text("Investigation Report")');
    await expect(page.locator("text=Deterministic Investigation Report")).toBeVisible();
    await expect(page.locator("text=Executive Summary")).toBeVisible();
    await expect(page.locator("text=Evidence Integrity Audit")).toBeVisible();
    await expect(page.locator("text=Candidate Event Correlations")).toBeVisible();

    // Toggle Markdown source view
    await page.click('button:has-text("Markdown Source")');
    await expect(page.locator("pre")).toContainText("# Incident Investigation Report");

    // 11. Navigate to Settings & Export
    await page.click('a:has-text("Settings & Export")');
    await expect(page.locator("text=Incident Metadata")).toBeVisible();
    await expect(page.locator("text=Export Portable Evidence Bundle")).toBeVisible();
    await expect(page.locator('a[href*="export?format=json"]')).toBeVisible();
    await expect(page.locator('a[href*="export?format=zip"]')).toBeVisible();

    // Download valid bundle
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('a[href*="export?format=json"]')
    ]);
    const validBundlePath = path.resolve(
      __dirname,
      "../fixtures/tracevault/exported-valid-bundle.json"
    );
    await download.saveAs(validBundlePath);

    // 12. Independent Bundle Verification — Valid Bundle
    await page.goto("/verify");
    await expect(page.locator("text=Verify Evidence Bundle")).toBeVisible();
    await page.setInputFiles('input[type="file"]', validBundlePath);
    await page.click('button:has-text("Run Independent Verification")');
    await expect(page.locator("text=Cryptographic Verification Passed")).toBeVisible({
      timeout: 10000
    });
    await expect(page.getByText("VERIFIED", { exact: true })).toBeVisible();

    // 13. Independent Bundle Verification — Reject Tampered Bundle
    const tamperedFixturePath = path.resolve(
      __dirname,
      "../fixtures/tracevault/tampered-bundle/bundle.json"
    );
    await page.setInputFiles('input[type="file"]', tamperedFixturePath);
    await page.click('button:has-text("Run Independent Verification")');

    // Assert tamper detection alert
    await expect(
      page.locator("text=Integrity Verification Failed / Tampering Detected")
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Hash chain broken at event sequence")).toBeVisible();
  });
});
