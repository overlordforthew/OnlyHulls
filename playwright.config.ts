import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { ensureBrowserTestEnv } from "./tests/browser/load-env";

ensureBrowserTestEnv(__dirname);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "https://onlyhulls.com";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  fullyParallel: true,
  globalSetup: path.join(__dirname, "tests/browser/global-setup.ts"),
  reporter: process.env.CI ? "github" : "list",
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

