import { execFileSync } from "node:child_process";
import packageJson from "../../package.json";

const BUILD_SHA_ENV_KEYS = [
  "ONLYHULLS_BUILD_SHA",
  "SOURCE_COMMIT",
  "COOLIFY_GIT_COMMIT",
  "VERCEL_GIT_COMMIT_SHA",
  "RENDER_GIT_COMMIT",
  "RAILWAY_GIT_COMMIT_SHA",
  "GIT_COMMIT_SHA",
  "COMMIT_SHA",
] as const;

const BUILD_BRANCH_ENV_KEYS = [
  "ONLYHULLS_BUILD_BRANCH",
  "SOURCE_BRANCH",
  "COOLIFY_BRANCH",
  "VERCEL_GIT_COMMIT_REF",
  "RENDER_GIT_BRANCH",
  "RAILWAY_GIT_BRANCH",
  "GIT_BRANCH",
  "BRANCH",
] as const;

type BuildValue = {
  key: string;
  value: string;
};

type GitBuildInfo = {
  sha: string | null;
  branch: string | null;
};

let cachedGitBuildInfo: GitBuildInfo | null = null;

function resolveFromEnv(keys: readonly string[]): BuildValue | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return { key, value };
    }
  }

  return null;
}

function runGit(args: string[]) {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function resolveGitBuildInfo() {
  if (!cachedGitBuildInfo) {
    cachedGitBuildInfo = {
      sha: runGit(["rev-parse", "HEAD"]),
      branch: runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
    };
  }

  return cachedGitBuildInfo;
}

export function getBuildInfo() {
  const envSha = resolveFromEnv(BUILD_SHA_ENV_KEYS);
  const envBranch = resolveFromEnv(BUILD_BRANCH_ENV_KEYS);
  const gitBuildInfo = resolveGitBuildInfo();
  const buildSha = envSha?.value ?? gitBuildInfo.sha ?? "unknown";
  const buildBranch = envBranch?.value ?? gitBuildInfo.branch ?? "unknown";

  return {
    version: packageJson.version,
    buildSha,
    buildShaShort: buildSha === "unknown" ? "unknown" : buildSha.slice(0, 7),
    buildBranch,
    buildShaSource: envSha ? `env:${envSha.key}` : gitBuildInfo.sha ? "git" : "unknown",
    buildBranchSource: envBranch ? `env:${envBranch.key}` : gitBuildInfo.branch ? "git" : "unknown",
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}
