import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const standaloneDir = path.join(rootDir, ".next", "standalone");
const standaloneServer = path.join(standaloneDir, "server.js");

function copyRequiredAssetDir(sourceRelative, targetRelative) {
  const source = path.join(rootDir, sourceRelative);
  const target = path.join(standaloneDir, targetRelative);

  if (!existsSync(source)) {
    throw new Error(`Missing required standalone asset directory: ${sourceRelative}`);
  }

  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

if (!existsSync(standaloneServer)) {
  throw new Error("Missing .next/standalone/server.js. Run `npm run build` before browser tests.");
}

copyRequiredAssetDir(path.join(".next", "static"), path.join(".next", "static"));

if (existsSync(path.join(rootDir, "public"))) {
  copyRequiredAssetDir("public", "public");
}

const env = {
  ...process.env,
  HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
  PORT: process.env.PORT || "3100",
};

const server = spawn(process.execPath, [standaloneServer], {
  cwd: rootDir,
  env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!server.killed) server.kill(signal);
  });
}

server.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
