import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 }
];

test.describe("Phase 5 Responsive Testing & Layout Verification", () => {
  const screenshotsDir = path.resolve(process.cwd(), "test-results/screenshots");

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  for (const vp of VIEWPORTS) {
    test(`TraceVault responsive layout at ${vp.name} (${vp.width}x${vp.height})`, async ({
      page
    }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (err) => {
        consoleErrors.push(err.message);
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("http://localhost:3001/");
      await page.waitForLoadState("networkidle");

      // Verify no critical console errors
      expect(consoleErrors.filter((e) => !e.includes("favicon"))).toEqual([]);

      // Verify header and main visibility
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();

      // Check horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalScroll).toBe(false);

      // Save screenshot
      const screenshotPath = path.join(screenshotsDir, `tracevault-${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      expect(fs.existsSync(screenshotPath)).toBe(true);
    });

    test(`AgentLedger responsive layout at ${vp.name} (${vp.width}x${vp.height})`, async ({
      page
    }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (err) => {
        consoleErrors.push(err.message);
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("http://localhost:3002/");
      await page.waitForLoadState("networkidle");

      // Verify no critical console errors
      expect(consoleErrors.filter((e) => !e.includes("favicon"))).toEqual([]);

      // Verify header and main visibility
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();

      // Check horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalScroll).toBe(false);

      // Save screenshot
      const screenshotPath = path.join(screenshotsDir, `agentledger-${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      expect(fs.existsSync(screenshotPath)).toBe(true);
    });
  }
});
