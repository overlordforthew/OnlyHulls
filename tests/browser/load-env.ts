import fs from "node:fs";
import path from "node:path";

const DEFAULT_BROWSER_ENV: Record<string, string> = {
  PLAYWRIGHT_SELLER_EMAIL: "browser-seller@onlyhulls.test",
  PLAYWRIGHT_SELLER_PASSWORD: "OnlyHullsBrowser!2026",
  PLAYWRIGHT_SELLER_NAME: "Browser Seller",
};

function stripQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseDotEnv(content: string) {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;

    const value = stripQuotes(line.slice(separatorIndex + 1).trim());
    process.env[key] = value;
  }
}

export function ensureBrowserTestEnv(rootDir: string) {
  const envPath = path.join(rootDir, ".env");

  if (fs.existsSync(envPath)) {
    parseDotEnv(fs.readFileSync(envPath, "utf8"));
  }

  for (const [key, value] of Object.entries(DEFAULT_BROWSER_ENV)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
