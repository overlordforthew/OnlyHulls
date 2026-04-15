import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { pool, query } from "../src/lib/db";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import { reindexBoatSearch } from "../src/lib/admin/maintenance";

const execFile = promisify(execFileCallback);

type RefreshScope = "location" | "image" | "both";

type CandidateRow = {
  id: string;
  source_url: string;
};

type MetricsRow = {
  active: number;
  visible: number;
  missing_location: number;
  missing_image: number;
};

function parseArgValue(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function parseLimit() {
  const raw = parseArgValue("--limit");
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseScope(): RefreshScope {
  const raw = (parseArgValue("--scope", "location") || "location").toLowerCase();
  if (raw === "image" || raw === "both" || raw === "location") return raw;
  throw new Error(`Unsupported --scope value: ${raw}`);
}

function buildScopeSql(scope: RefreshScope) {
  const missingLocation =
    "COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_location'";
  const missingImage =
    "COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_image'";

  if (scope === "location") return missingLocation;
  if (scope === "image") return missingImage;
  return `(${missingLocation} OR ${missingImage})`;
}

async function fetchMetrics() {
  const rows = await query<MetricsRow>(
    `SELECT
       COUNT(*)::int AS active,
       COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")})::int AS visible,
       COUNT(*) FILTER (
         WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_location'
       )::int AS missing_location,
       COUNT(*) FILTER (
         WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_image'
       )::int AS missing_image
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.listing_source = 'imported'
       AND b.source_site = 'sailboatlistings'
       AND b.status = 'active'`
  );

  return rows[0];
}

async function fetchCandidates(scope: RefreshScope, limit: number | null) {
  const whereScope = buildScopeSql(scope);
  const limitSql = limit ? "LIMIT $1" : "";
  const params = limit ? [limit] : [];

  return query<CandidateRow>(
    `SELECT b.id, b.source_url
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.listing_source = 'imported'
       AND b.source_site = 'sailboatlistings'
       AND b.status = 'active'
       AND b.source_url IS NOT NULL
       AND ${whereScope}
     ORDER BY b.updated_at DESC, b.id
     ${limitSql}`,
    params
  );
}

function parseJsonFromStdout(stdout: string) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return null;
}

async function main() {
  const scope = parseScope();
  const limit = parseLimit();
  const skipReindex = hasFlag("--skip-reindex");
  const before = await fetchMetrics();
  const candidates = await fetchCandidates(scope, limit);

  if (candidates.length === 0) {
    console.log(
      JSON.stringify(
        {
          scope,
          selected: 0,
          message: "No stale Sailboat Listings rows matched the requested scope.",
          before,
          after: before,
        },
        null,
        2
      )
    );
    return;
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sailboatlistings-refresh-"));
  const inputPath = path.join(tempDir, "candidates.json");
  const outputPath = path.join(tempDir, "scraped.json");

  try {
    await writeFile(
      inputPath,
      JSON.stringify(
        candidates.map((candidate) => ({
          id: candidate.id,
          url: candidate.source_url,
        })),
        null,
        2
      )
    );

    const scrapeResult = await execFile(
      "python3",
      ["scraper/scrape_sailboat_urls.py", "--input", inputPath, "--output", outputPath],
      {
        cwd: process.cwd(),
        timeout: 30 * 60 * 1000,
        maxBuffer: 20 * 1024 * 1024,
      }
    );
    const scrapeSummary = parseJsonFromStdout(scrapeResult.stdout) || {};

    const scrapedRaw = await readFile(outputPath, "utf8");
    const scrapedBoats = JSON.parse(scrapedRaw) as Array<Record<string, unknown>>;
    if (scrapedBoats.length === 0) {
      throw new Error("Scrape completed without any rows to update.");
    }

    const tsxCliPath = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    const importResult = await execFile(
      process.execPath,
      [tsxCliPath, "scripts/import-scraped.ts", outputPath, "sailboatlistings", "--update"],
      {
        cwd: process.cwd(),
        timeout: 30 * 60 * 1000,
        maxBuffer: 20 * 1024 * 1024,
      }
    );

    let reindexResult: { indexed: number } | null = null;
    if (!skipReindex) {
      reindexResult = await reindexBoatSearch();
    }

    const after = await fetchMetrics();

    console.log(
      JSON.stringify(
        {
          scope,
          selected: candidates.length,
          scraped: scrapedBoats.length,
          scrapeSummary,
          importSummary: parseJsonFromStdout(importResult.stdout),
          reindexResult,
          before,
          after,
        },
        null,
        2
      )
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => null);
  }
}

main()
  .catch((err) => {
    console.error("Sailboat Listings stale-detail refresh failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
