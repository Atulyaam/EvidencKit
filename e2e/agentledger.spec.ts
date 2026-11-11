import { test, expect } from "@playwright/test";

test.describe("AgentLedger — AI Agent Auditing Application User Journey", () => {
  test.use({ baseURL: "http://localhost:3002" });

  test("loads landing dashboard, metrics, and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AgentLedger/);

    // Verify Brand Header
    await expect(page.locator("header")).toContainText("AgentLedger");
    await expect(page.locator("header")).toContainText("Auditor Mode");

    // Verify Dashboard Metrics & Hero
    await expect(page.locator("text=Total Sessions")).toBeVisible();
    await expect(page.locator("text=Active Runs")).toBeVisible();
    await expect(page.locator("text=Pending Approvals")).toBeVisible();
    await expect(page.locator("text=Integrity Verified")).toBeVisible();

    // Verify Demo Launcher Button
    await expect(page.locator("text=Launch Controlled Demo")).toBeVisible();
  });

  test("creates new agent session via wizard", async ({ page }) => {
    await page.goto("/sessions/new");
    await expect(page.locator("h1")).toContainText("Create Agent Audit Session");

    // Click a preset button
    await page.click("text=Security Policy Auditor");

    // Submit form
    await page.click('button:has-text("Create Audit Session")');

    // Wait for redirect to session overview
    await page.waitForURL(/\/sessions\/session_/);
    await expect(page.locator("main")).toContainText("session_");
  });

  test("executes end-to-end audit lifecycle: demo runner, approvals, timeline, diffs, replay, and export", async ({
    page
  }) => {
    // 1. Launch Demo from Homepage
    await page.goto("/");
    await page.click("text=Launch Controlled Demo");

    // Wait for demo runner to finish and redirect to timeline
    await page.waitForURL(/\/sessions\/.*\/timeline/, { timeout: 35000 });
    await expect(page.locator("text=agent.session.created").first()).toBeVisible();
    await expect(page.locator("text=agent.approval.decided").first()).toBeVisible();

    // 2. Click an event to inspect cryptographic provenance
    await page.locator("text=agent.session.created").first().click();
    await expect(page.locator("text=Provenance & Hash Inspector")).toBeVisible();
    await expect(page.locator("text=Event Hash (SHA-256)")).toBeVisible();

    // 3. Navigate to Overview
    await page.click('a:has-text("Overview")');
    await expect(page.locator("text=Cryptographic Integrity")).toBeVisible();
    await expect(page.locator("text=Chain Head Hash (SHA-256)")).toBeVisible();

    // 4. Human Approval Gates Tab
    await page.click('a:has-text("Approvals")');
    await page.waitForURL(/\/sessions\/.*\/approvals/);
    await expect(page.locator("text=Human Approval & Denial Gates")).toBeVisible();
    await expect(page.locator("text=rejected").first()).toBeVisible();

    // 5. Files Tab
    await page.click('a:has-text("Files")');
    await page.waitForURL(/\/sessions\/.*\/files/);
    await expect(page.locator("text=Sandboxed File Modifications & Diffs")).toBeVisible();

    // 6. Forensic Replay Player Tab
    await page.click('a:has-text("Replay")');
    await page.waitForURL(/\/sessions\/.*\/replay/);
    await expect(page.locator("text=Deterministic Forensic Replay")).toBeVisible();
    await expect(page.locator("text=Step 1 of")).toBeVisible();

    // Click Next Step
    await page.click("button[title='Next Step']");
    await expect(page.locator("text=Step 2 of")).toBeVisible();

    // 7. Export & Verification Tab
    await page.click('a:has-text("Export")');
    await page.waitForURL(/\/sessions\/.*\/export/);
    await expect(page.locator("text=EvidenceKit Portable Export Bundle")).toBeVisible();
    await expect(page.locator("text=Download Bundle JSON")).toBeVisible();

    // 8. Independent Bundle Verifier
    await page.goto("/verify");
    await expect(page.locator("h1")).toContainText("EvidenceKit Cryptographic Verifier");
    await expect(page.locator("text=Upload Export Bundle (.json)")).toBeVisible();
    await expect(page.locator("text=Run Server Verification")).toBeVisible();
  });
});
