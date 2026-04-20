import fs from "fs";
import path from "path";

import { pool, query } from "../src/lib/db";
import {
  buildBaseVisibleImportQualitySql,
  buildBaseVisibleImportQualitySqlWithoutSourceFreshness,
  buildVisibleImportQualitySql,
} from "../src/lib/import-quality";
import {
  buildMapLaunchPreflight,
  type MapLaunchBatchSimulation,
  type MapLaunchInventorySnapshot,
  type MapLaunchPinAuditInput,
  type MapLaunchPreflightPhase,
  type MapLaunchPreflightResult,
  type MapLaunchPreflightStep,
} from "../src/lib/locations/map-launch-preflight";
import { deriveImportVisibilityCounts } from "../src/lib/source-health";
import { buildGeocodeQuery, getGeocodingConfig } from "../src/lib/locations/geocoding";
import { getMapPinAuditReport } from "../src/lib/locations/map-pin-audit-data";
import {
  buildMapPinAuditSampleHash,
  parseMapPinAuditLimit,
  parseMapPinAuditPrecision,
  type MapPinAuditAttestation,
} from "../src/lib/locations/map-pin-audit";
import { getMapReadinessSnapshot } from "../src/lib/locations/map-readiness-data";

type CandidateRow = {
  location_text: string | null;
  location_country: string | null;
  location_region: string | null;
  location_market_slugs: string[];
  location_confidence: string | null;
};

type InventoryRow = {
  active_count: string;
  quality_visible_before_freshness_count: string;
  quality_visible_count: string;
  visible_count: string;
};

const DEFAULT_BATCH_LIMIT = 100;
const DEFAULT_PING_TIMEOUT_MS = 5000;
const DEFAULT_PIN_AUDIT_MAX_AGE_DAYS = 7;
const DEFAULT_PIN_AUDIT_MIN_SAMPLE_SIZE = 20;

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

function getPingTimeoutMs() {
  const parsed = Number(getArgValue("--ping-timeout-ms") || DEFAULT_PING_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 30_000) : DEFAULT_PING_TIMEOUT_MS;
}

function getPinAuditMaxAgeDays() {
  const parsed = Number(getArgValue("--pin-audit-max-age-days") || DEFAULT_PIN_AUDIT_MAX_AGE_DAYS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 90) : DEFAULT_PIN_AUDIT_MAX_AGE_DAYS;
}

function getPinAuditMinSampleSize() {
  const parsed = Number(getArgValue("--pin-audit-min-sample-size") || DEFAULT_PIN_AUDIT_MIN_SAMPLE_SIZE);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 200) : DEFAULT_PIN_AUDIT_MIN_SAMPLE_SIZE;
}

function getPhase(): MapLaunchPreflightPhase {
  const value = String(getArgValue("--phase") || "launch").trim().toLowerCase();
  if (value === "backfill" || value === "launch") return value;

  throw new Error(`Invalid --phase=${value}. Expected --phase=backfill or --phase=launch.`);
}

function readReadinessReport(filePath: string) {
  const resolved = path.resolve(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function readPinAuditReport(filePath: string) {
  const resolved = path.resolve(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(resolved, "utf8")) as Partial<MapPinAuditAttestation>;
}

function redactUrl(value: string) {
  try {
    const url = new URL(value);
    for (const key of ["key", "api_key", "access_token", "token"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "redacted");
    }
    return url.toString();
  } catch {
    return value.replace(/([?&](?:key|api_key|access_token|token)=)[^&]+/gi, "$1redacted");
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getExpandedMapStyleUrl() {
  const styleUrl = String(process.env.NEXT_PUBLIC_MAP_STYLE_URL || "").trim();
  if (!styleUrl || styleUrl.includes("$")) return null;

  try {
    const url = new URL(styleUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function getOpenCagePingUrl() {
  const config = getGeocodingConfig();
  if (config.provider !== "opencage" || !config.apiKey) return null;
  const url = new URL(config.baseUrl);
  url.searchParams.set("q", "Fajardo, Puerto Rico");
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("limit", "1");
  url.searchParams.set("no_annotations", "1");
  url.searchParams.set("no_record", "1");

  return url.toString();
}

async function runPingChecks(
  phase: MapLaunchPreflightPhase,
  timeoutMs: number
): Promise<MapLaunchPreflightStep[]> {
  const steps: MapLaunchPreflightStep[] = [];
  const styleUrl = getExpandedMapStyleUrl();
  if (phase === "launch") {
    if (!styleUrl) {
      steps.push({
        section: "network",
        key: "map_style_ping_skipped",
        status: "fail",
        message: "Map style ping could not run because the style URL is missing or still contains an env placeholder.",
        target: "expanded NEXT_PUBLIC_MAP_STYLE_URL",
        action: "Configure the tile style URL before using --ping.",
      });
    } else {
      try {
        const response = await fetchWithTimeout(styleUrl, timeoutMs);
        steps.push({
          section: "network",
          key: "map_style_ping",
          status: response.ok ? "pass" : "fail",
          message: response.ok
            ? "Map style URL responded successfully."
            : `Map style URL responded with HTTP ${response.status}.`,
          actual: `${response.status} ${redactUrl(styleUrl)}`,
          target: "HTTP 2xx",
          action: response.ok ? undefined : "Fix the tile provider key, style URL, or resource restrictions.",
        });
      } catch (err) {
        steps.push({
          section: "network",
          key: "map_style_ping",
          status: "fail",
          message: err instanceof Error ? err.message : "Map style ping failed.",
          actual: redactUrl(styleUrl),
          target: "reachable map style URL",
          action: "Fix the tile provider key, style URL, or network egress before launch.",
        });
      }
    }
  } else {
    steps.push({
      section: "network",
      key: "map_style_ping_deferred",
      status: "info",
      message: "Map style ping is deferred during geocode backfill and remains required for launch preflight.",
      target: "run --phase=launch --ping before enabling public map flags",
    });
  }

  const config = getGeocodingConfig();
  const openCagePingUrl = getOpenCagePingUrl();
  if (!openCagePingUrl) {
    steps.push({
      section: "network",
      key: "geocoder_ping_skipped",
      status: "fail",
      message:
        config.provider === "nominatim"
          ? "Geocoder ping skipped because Nominatim is validation-only for this rollout."
          : "Geocoder ping could not run because OpenCage is not configured.",
      actual: config.provider,
      target: "opencage with API key",
      action: "Configure LOCATION_GEOCODING_PROVIDER=opencage and LOCATION_GEOCODING_API_KEY.",
    });
  } else {
    try {
      const response = await fetchWithTimeout(openCagePingUrl, timeoutMs);
      steps.push({
        section: "network",
        key: "geocoder_ping",
        status: response.ok ? "pass" : "fail",
        message: response.ok
          ? "OpenCage geocoder responded successfully to the one-request connectivity probe."
          : `OpenCage geocoder responded with HTTP ${response.status}.`,
        actual: `${response.status} ${redactUrl(openCagePingUrl)}`,
        target: "HTTP 2xx",
        action: response.ok ? undefined : "Fix the OpenCage key, quota, or provider configuration before --apply.",
      });
    } catch (err) {
      steps.push({
        section: "network",
        key: "geocoder_ping",
        status: "fail",
        message: err instanceof Error ? err.message : "OpenCage geocoder ping failed.",
        actual: redactUrl(openCagePingUrl),
        target: "reachable OpenCage API",
        action: "Fix the OpenCage key, quota, or network egress before --apply.",
      });
    }
  }

  return steps;
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

async function getInventorySnapshot(): Promise<MapLaunchInventorySnapshot> {
  const row = await query<InventoryRow>(
    `SELECT
       COUNT(*)::text AS active_count,
       COUNT(*) FILTER (WHERE ${buildBaseVisibleImportQualitySqlWithoutSourceFreshness("b")})::text AS quality_visible_before_freshness_count,
       COUNT(*) FILTER (WHERE ${buildBaseVisibleImportQualitySql("b")})::text AS quality_visible_count,
       COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")})::text AS visible_count
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
       AND b.listing_source = 'imported'`
  );
  const first = row[0];
  const activeCount = Number.parseInt(first?.active_count || "0", 10);
  const qualityVisibleBeforeFreshnessCount = Number.parseInt(
    first?.quality_visible_before_freshness_count || "0",
    10
  );
  const qualityVisibleBeforePolicyCount = Number.parseInt(
    first?.quality_visible_count || "0",
    10
  );
  const visibleCount = Number.parseInt(first?.visible_count || "0", 10);

  return {
    activeCount,
    qualityVisibleBeforeFreshnessCount,
    qualityVisibleBeforePolicyCount,
    visibleCount,
    ...deriveImportVisibilityCounts({
      active: activeCount,
      qualityVisibleBeforeFreshness: qualityVisibleBeforeFreshnessCount,
      qualityVisibleBeforePolicy: qualityVisibleBeforePolicyCount,
      visible: visibleCount,
    }),
  };
}

async function getPinAuditInput(
  reportPath: string | null,
  skipDb: boolean,
  maxAgeDays: number,
  minSampleSize: number
): Promise<MapLaunchPinAuditInput | null> {
  if (!reportPath) return null;

  const report = readPinAuditReport(reportPath);
  let currentSampleHash: string | null = null;
  if (!skipDb && process.env.DATABASE_URL && report.sampleSeed && report.sampleSize) {
    const precision = report.precision === "all" ? null : parseMapPinAuditPrecision(String(report.precision || ""));
    const currentReport = await getMapPinAuditReport({
      backupTable: typeof report.backupTable === "string" ? report.backupTable : null,
      limit: parseMapPinAuditLimit(String(report.sampleLimit || report.sampleSize)),
      precision,
      seed: report.sampleSeed,
    });
    currentSampleHash = buildMapPinAuditSampleHash(currentReport);
  }

  return {
    currentSampleHash,
    maxAgeDays,
    minSampleSize,
    report,
    reportPath,
  };
}

function renderText(result: MapLaunchPreflightResult) {
  const lines = [
    `Map launch preflight (phase=${result.phase}): ${result.verdict}`,
    `Generated: ${result.generatedAt}`,
    "",
  ];
  const sections: Array<MapLaunchPreflightStep["section"]> = [
    "env",
    "network",
    "readiness",
    "inventory",
    "review_queue",
    "pin_audit",
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
  const ping = hasFlag("--ping");
  const phase = getPhase();
  const readinessReportPath = getArgValue("--readiness-report");
  const pinAuditReportPath = getArgValue("--pin-audit-report");
  const batchLimit = getBatchLimit();
  const pingTimeoutMs = getPingTimeoutMs();
  const pinAuditMaxAgeDays = getPinAuditMaxAgeDays();
  const pinAuditMinSampleSize = getPinAuditMinSampleSize();
  const externalSteps: MapLaunchPreflightStep[] = [];
  let readiness = null;
  let batchSimulation: MapLaunchBatchSimulation | null = null;
  let inventory: MapLaunchInventorySnapshot | null = null;
  let pinAudit: MapLaunchPinAuditInput | null = null;

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
    inventory = await getInventorySnapshot();
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

  pinAudit = await getPinAuditInput(
    pinAuditReportPath,
    skipDb,
    pinAuditMaxAgeDays,
    pinAuditMinSampleSize
  );

  if (ping) {
    externalSteps.push(...(await runPingChecks(phase, pingTimeoutMs)));
  }

  const result = buildMapLaunchPreflight({
    env: process.env,
    phase,
    inventory,
    pinAudit,
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
