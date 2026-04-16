import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { ensureBrowserTestEnv } from "./tests/browser/load-env";

ensureBrowserTestEnv(__dirname);
const localBaseURL = process.env.PLAYWRIGHT_LOCAL_BASE_URL || "http://127.0.0.1:3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || localBaseURL;
const shouldUseLocalWebServer = !process.env.PLAYWRIGHT_BASE_URL;
const localPort = new URL(localBaseURL).port || "3100";

// Use deploy-health for the readiness check — it returns 200 without any
// database access, so the CI web-server probe succeeds even when service
// containers (Postgres, Redis, Meilisearch) are not running.
const webServerReadinessURL = `${localBaseURL}/api/public/deploy-health`;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  fullyParallel: true,
  globalSetup: path.join(__dirname, "tests/browser/global-setup.ts"),
  reporter: process.env.CI ? "github" : "list",
  webServer: shouldUseLocalWebServer
    ? {
        command: process.env.CI
          ? `npm run start -- --hostname 127.0.0.1 --port ${localPort}`
          : `npm run dev -- --hostname 127.0.0.1 --port ${localPort}`,
        url: webServerReadinessURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
