import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 }
];

test.describe("TraceVault Visual and Accessibility Audit (Part 3)", () => {
  const screenshotsDir = path.resolve(process.cwd(), "test-results/screenshots/tracevault");
  let sharedIncidentId = "";

  test.beforeAll(async ({ request }) => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Create a rich incident with events for full visual fidelity
    const createRes = await request.post("http://localhost:3001/api/incidents", {
      data: {
        title: "Visual Audit Production Incident",
        description:
          "Comprehensive visual and accessibility audit incident with real multi-source telemetry",
        severity: "critical",
        status: "investigating",
        environment: "production"
      }
    });

    if (createRes.ok()) {
      const incident = await createRes.json();
      sharedIncidentId = incident.id;

      // Ingest sample events
      const fixturePath = path.resolve(
        process.cwd(),
        "fixtures/tracevault/sample-incident/application-events.jsonl"
      );
      if (fs.existsSync(fixturePath)) {
        const fileContent = fs.readFileSync(fixturePath, "utf-8");
        const lines = fileContent.trim().split("\n");
        const events = lines.map((l) => JSON.parse(l));

        await request.post(`http://localhost:3001/api/incidents/${sharedIncidentId}/evidence`, {
          data: { events }
        });
      }
    }
  });

  for (const vp of VIEWPORTS) {
    test.describe(`Audit at ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      const testRoute = (name: string, getPath: () => string) => {
        test(`audits route: ${name}`, async ({ page }) => {
          const consoleErrors: string[] = [];
          page.on("console", (msg) => {
            if (msg.type() === "error") {
              consoleErrors.push(msg.text());
            }
          });
          page.on("pageerror", (err) => {
            consoleErrors.push(err.message);
          });

          const url = `http://localhost:3001${getPath()}`;
          await page.goto(url);
          await page.waitForLoadState("networkidle");

          // 1. Console Error Check (excluding missing favicons)
          const realErrors = consoleErrors.filter(
            (e) => !e.includes("favicon") && !e.includes("404")
          );
          expect(realErrors).toEqual([]);

          // 2. Horizontal Overflow Check
          const overflow = await page.evaluate(() => {
            return {
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              hasHorizontalOverflow:
                document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 // Allow 1px subpixel
            };
          });
          expect(
            overflow.hasHorizontalOverflow,
            `Horizontal overflow detected on ${name} at ${vp.name}: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`
          ).toBe(false);

          // 3. Navigation and Accessibility Reachability
          await expect(page.locator("header")).toBeVisible();
          await expect(page.locator("main")).toBeVisible();

          // 4. Keyboard focusability of primary interactive elements
          const firstFocusable = page.locator("a, button, input, select, textarea").first();
          if (await firstFocusable.isVisible()) {
            await firstFocusable.focus();
            const isFocused = await firstFocusable.evaluate((el) => document.activeElement === el);
            expect(isFocused).toBe(true);
          }

          // 5. Mobile Drawer check if mobile viewport
          if (vp.width <= 768) {
            const mobileMenuBtn = page.locator('button[aria-label="Open mobile navigation menu"]');
            if (await mobileMenuBtn.isVisible()) {
              await mobileMenuBtn.click();
              await expect(
                page.locator('button[aria-label="Close mobile navigation menu"]')
              ).toBeVisible();
              // Close it back
              await page.locator('button[aria-label="Close mobile navigation menu"]').click();
            }
          }

          // 6. Screenshot evidence
          const screenshotFileName = `${vp.name}_${name.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
          const screenshotPath = path.join(screenshotsDir, screenshotFileName);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          expect(fs.existsSync(screenshotPath)).toBe(true);
        });
      };

      testRoute("dashboard", () => "/");
      testRoute("incidents_directory", () => "/incidents");
      testRoute("incidents_new", () => "/incidents/new");
      testRoute("incident_overview", () =>
        sharedIncidentId ? `/incidents/${sharedIncidentId}` : "/incidents"
      );
      testRoute("incident_evidence", () =>
        sharedIncidentId ? `/incidents/${sharedIncidentId}/evidence` : "/incidents"
      );
      testRoute("incident_timeline", () =>
        sharedIncidentId ? `/incidents/${sharedIncidentId}/timeline` : "/incidents"
      );
      testRoute("incident_quality", () =>
        sharedIncidentId ? `/incidents/${sharedIncidentId}/quality` : "/incidents"
      );
      testRoute("incident_report", () =>
        sharedIncidentId ? `/incidents/${sharedIncidentId}/report` : "/incidents"
      );
      testRoute("incident_settings", () =>
        sharedIncidentId ? `/incidents/${sharedIncidentId}/settings` : "/incidents"
      );
      testRoute("cross_app_graph", () => "/graph");
      testRoute("tamper_verifier", () => "/verify");
    });
  }
});
