import fs from "fs";
import path from "path";

import { pool, query } from "../src/lib/db";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import { buildMapLaunchPreflight, type MapLaunchBatchSimulation, type MapLaunchPreflightResult, type MapLaunchPreflightStep } from "../src/lib/locations/map-launch-preflight";
import { buildGeocodeQuery } from "../src/lib/locations/geocoding";
import { getMapReadinessSnapshot } from "../src/lib/locations/map-readiness-data";

type CandidateRow = {
  location_text: string | null;
  location_country: string | null;
  location_region: string | null;
  location_market_slugs: string[];
  location_confidence: string | null;
};

const DEFAULT_BATCH_LIMIT = 100;

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function getBatchLimit() {
  const parsed = Number(getArgValue("--batch-limit") || DEFAULT_BATCH_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 2000) : DEFAULT_BATCH_LIMIT;
}

function readReadinessReport(filePath: string) {
  const resolved = path.resolve(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

async function getBatchSimulation(limit: number): Promise<MapLaunchBatchSimulation> {
  const visibleSql = buildVisibleImportQualitySql("b");
  const rows = await query<CandidateRow>(
    `SELECT b.location_text,
            b.location_country,
            b.location_region,
            COALESCE(b.location_market_slugs, '{}') AS location_market_slugs,
            b.location_confidence
     FROM boats b
     WHERE b.status = 'active'
       AND ${visibleSql}
       AND COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> ''
       AND (
         b.location_lat IS NULL
         OR b.location_lng IS NULL
         OR b.location_lat NOT BETWEEN -90 AND 90
         OR b.location_lng NOT BETWEEN -180 AND 180
       )
       AND b.location_geocode_status = 'pending'
     ORDER BY CASE b.location_confidence
                WHEN 'city' THEN 0
                WHEN 'region' THEN 1
                ELSE 2
              END,
              CARDINALITY(COALESCE(b.location_market_slugs, '{}'::text[])) DESC`
  );
  const readyQueries = rows
    .map((row) =>
      buildGeocodeQuery({
        locationText: row.location_text,
        country: row.location_country,
        region: row.location_region,
        marketSlugs: row.location_market_slugs,
        confidence: row.location_confidence,
      })
    )
    .filter((query): query is NonNullable<typeof query> => query !== null);
  const selectedQueries = readyQueries.slice(0, limit);

  return {
    limit,
    totalCandidates: rows.length,
    geocodableCandidates: readyQueries.length,
    selectedRows: selectedQueries.length,
    selectedUniqueQueries: new Set(selectedQueries.map((query) => query.queryKey)).size,
  };
}

function renderText(result: MapLaunchPreflightResult) {
  const lines = [
    `Map launch preflight: ${result.verdict}`,
    `Generated: ${result.generatedAt}`,
    "",
  ];
  const sections: Array<MapLaunchPreflightStep["section"]> = [
    "env",
    "readiness",
    "review_queue",
    "batch_simulation",
    "verdict",
  ];

  for (const section of sections) {
    const steps = result.steps.filter((item) => item.section === section);
    if (steps.length === 0) continue;
    lines.push(section.replace(/_/g, " ").toUpperCase());
    for (const item of steps) {
      const actual = item.actual === undefined ? "" : ` actual=${String(item.actual)}`;
      const target = item.target ? ` target=${item.target}` : "";
      lines.push(`- [${item.status.toUpperCase()}] ${item.key}: ${item.message}${actual}${target}`);
      if (item.action) lines.push(`  action: ${item.action}`);
    }
    lines.push("");
  }

  if (result.nextCommands.length > 0) {
    lines.push("NEXT COMMANDS");
    for (const command of result.nextCommands) lines.push(`- ${command}`);
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const json = hasFlag("--json");
  const skipDb = hasFlag("--skip-db");
  const readinessReportPath = getArgValue("--readiness-report");
  const batchLimit = getBatchLimit();
  const externalSteps: MapLaunchPreflightStep[] = [];
  let readiness = null;
  let batchSimulation: MapLaunchBatchSimulation | null = null;

  if (readinessReportPath) {
    readiness = readReadinessReport(readinessReportPath);
  } else if (!skipDb && process.env.DATABASE_URL) {
    readiness = await getMapReadinessSnapshot();
  } else {
    externalSteps.push({
      section: "readiness",
      key: "database_url_missing",
      status: "fail",
      message: "DATABASE_URL is not configured, so live readiness could not be checked.",
      target: "DATABASE_URL pointing at the intended environment",
      action: "Run this command in the production/staging environment with DATABASE_URL configured.",
    });
  }

  if (!skipDb && process.env.DATABASE_URL) {
    batchSimulation = await getBatchSimulation(batchLimit);
  } else if (readinessReportPath) {
    externalSteps.push({
      section: "batch_simulation",
      key: "batch_simulation_skipped",
      status: "warn",
      message: "Batch simulation was skipped because this run used a readiness report artifact without DATABASE_URL.",
      target: "live DATABASE_URL for batch simulation before --apply",
    });
  }

  const result = buildMapLaunchPreflight({
    env: process.env,
    readiness,
    batchSimulation,
    externalSteps,
  });

  console.log(json ? JSON.stringify(result, null, 2) : renderText(result));
  process.exitCode = result.verdict === "GO" ? 0 : 2;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
