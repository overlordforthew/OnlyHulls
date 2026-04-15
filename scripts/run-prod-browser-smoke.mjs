import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "node_modules", "playwright", "cli.js");
const extraArgs = process.argv.slice(2);
const hasWorkersArg = extraArgs.some((arg, index) => {
  if (arg.startsWith("--workers=")) return true;
  return arg === "--workers" && extraArgs[index + 1] !== undefined;
});

const args = [
  cliPath,
  "test",
  "tests/browser/smoke.spec.ts",
  ...(hasWorkersArg ? [] : ["--workers=1"]),
  ...extraArgs,
];

const result = spawnSync(process.execPath, args, {
  cwd: repoRoot,
  env: {
    ...process.env,
    PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || "https://onlyhulls.com",
  },
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
