import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    headless: true,
    extraHTTPHeaders: {
      Authorization: `Bearer ${process.env.AUTH_SECRET || "development-auth-secret-32-chars-long-minimum!"}`
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "pnpm --filter tracevault start -p 3001",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        NODE_ENV: "test"
      }
    },
    {
      command: "pnpm --filter agentledger start -p 3002",
      url: "http://localhost:3002/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        NODE_ENV: "test"
      }
    }
  ]
});
