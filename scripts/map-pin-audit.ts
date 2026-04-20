import { pool } from "../src/lib/db";
import { PUBLIC_MAP_PRECISIONS, type PublicMapPrecision } from "../src/lib/locations/map-coordinates";
import {
  buildMapPinAuditWhereSql,
  buildMapPinAuditUrl,
  buildMapPinListingUrl,
  isSafeGeocodeBackupTableName,
  normalizePublicBaseUrl,
  parseMapPinAuditLimit,
  parseMapPinAuditPrecision,
  type MapPinAuditReport,
  type MapPinAuditRow,
} from "../src/lib/locations/map-pin-audit";

type CountRow = {
  count: string;
};

type PinRow = {
  slug: string | null;
  title: string | null;
  location_text: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  precision: string | null;
  provider: string | null;
  score: string | number | null;
  geocoded_at: string | null;
  place_name: string | null;
};

async function runQuery<T extends Record<string, unknown>>(text: string, params?: unknown[]) {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

async function runQueryOne<T extends Record<string, unknown>>(text: string, params?: unknown[]) {
  const rows = await runQuery<T>(text, params);
  return rows[0] ?? null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function getSeed() {
  return getArgValue("--seed") || new Date().toISOString().slice(0, 10);
}

function getBaseUrl() {
  return normalizePublicBaseUrl(
    getArgValue("--base-url") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      undefined
  );
}

function assertPrecision(value: string | null) {
  if (!value) return null;
  const precision = parseMapPinAuditPrecision(value);
  if (!precision) {
    throw new Error(`Invalid --precision=${value}. Expected one of: ${PUBLIC_MAP_PRECISIONS.join(", ")}`);
  }

  return precision;
}

function assertBackupTable(value: string | null) {
  if (!value) return null;
  if (!isSafeGeocodeBackupTableName(value)) {
    throw new Error("Invalid --backup-table. Expected boat_geocode_backup_YYYYMMDDHHMMSS.");
  }

  return value;
}

function toNumber(value: string | number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPrecision(value: string | null): PublicMapPrecision | null {
  return parseMapPinAuditPrecision(value);
}

async function getAuditReport(): Promise<MapPinAuditReport> {
  const limit = parseMapPinAuditLimit(getArgValue("--limit"));
  const seed = getSeed();
  const baseUrl = getBaseUrl();
  const precision = assertPrecision(getArgValue("--precision"));
  const backupTable = assertBackupTable(getArgValue("--backup-table"));
  const { whereSql, params } = buildMapPinAuditWhereSql({ precision, backupTable });
  const count = await runQueryOne<CountRow>(
    `SELECT COUNT(*)::text AS count
     FROM boats b
     WHERE ${whereSql}`,
    params
  );
  const rows = await runQuery<PinRow>(
    `SELECT b.slug,
            CONCAT_WS(' ', b.year::text, NULLIF(TRIM(b.make), ''), NULLIF(TRIM(b.model), '')) AS title,
            b.location_text,
            b.location_lat AS latitude,
            b.location_lng AS longitude,
            b.location_geocode_precision AS precision,
            b.location_geocode_provider AS provider,
            b.location_geocode_score AS score,
            b.location_geocoded_at::text AS geocoded_at,
            b.location_geocode_place_name AS place_name
     FROM boats b
     WHERE ${whereSql}
     ORDER BY md5(COALESCE(b.slug, b.id::text) || $${params.length + 1}), b.slug
     LIMIT $${params.length + 2}`,
    [...params, seed, limit]
  );
  const pins = rows
    .map((row): MapPinAuditRow | null => {
      const slug = String(row.slug || "").trim();
      const latitude = toNumber(row.latitude);
      const longitude = toNumber(row.longitude);
      const rowPrecision = toPrecision(row.precision);
      if (!slug || latitude === null || longitude === null || !rowPrecision) return null;
      const auditUrl = buildMapPinAuditUrl(latitude, longitude);
      if (!auditUrl) return null;

      return {
        slug,
        title: row.title || slug,
        locationText: row.location_text,
        latitude,
        longitude,
        precision: rowPrecision,
        provider: row.provider,
        score: toNumber(row.score),
        geocodedAt: row.geocoded_at,
        placeName: row.place_name,
        auditUrl,
        listingUrl: buildMapPinListingUrl(baseUrl, slug),
      };
    })
    .filter((row): row is MapPinAuditRow => row !== null);

  return {
    generatedAt: new Date().toISOString(),
    seed,
    limit,
    eligibleCount: Number(count?.count || 0),
    returnedCount: pins.length,
    precision: precision || "all",
    backupTable,
    pins,
  };
}

function renderText(report: MapPinAuditReport) {
  const lines = [
    `Map pin audit sample: ${report.returnedCount}/${report.eligibleCount} eligible pins`,
    `Seed: ${report.seed}`,
    `Precision: ${report.precision}`,
    `Backup table: ${report.backupTable || "none"}`,
    "",
  ];

  if (report.pins.length === 0) {
    lines.push("No public-map-eligible pins matched the audit filters.");
    return lines.join("\n");
  }

  report.pins.forEach((pin, index) => {
    lines.push(`${index + 1}. ${pin.title}`);
    lines.push(`   Listing: ${pin.listingUrl}`);
    lines.push(`   Location: ${pin.locationText || "unknown"}`);
    lines.push(
      `   Pin: ${pin.precision} / ${pin.provider || "unknown"} / score ${
        pin.score === null ? "unknown" : pin.score
      }`
    );
    lines.push(`   Place: ${pin.placeName || "unknown"}`);
    lines.push(`   Coordinates: ${pin.latitude}, ${pin.longitude}`);
    lines.push(`   Audit: ${pin.auditUrl}`);
    lines.push("");
  });

  return lines.join("\n");
}

function getReadableErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const errorRecord = err as unknown as Record<string, unknown>;
  const nestedErrors = Array.isArray(errorRecord.errors)
    ? errorRecord.errors
        .map((nestedError) => (nestedError instanceof Error ? nestedError.message : String(nestedError)))
        .filter(Boolean)
    : [];
  const parts = [err.message, ...nestedErrors].filter(Boolean);

  return parts.join("; ") || err.name || "unknown error";
}

function getDatabaseFailureMessage(err: unknown) {
  const message = getReadableErrorMessage(err);
  return [
    "Map pin audit could not query the database.",
    "Confirm DATABASE_URL points at the intended staging or production database, the connection is reachable, and the latest migrations have run.",
    `Underlying error: ${message}`,
  ].join("\n");
}

function isLikelyDatabaseFailure(err: unknown) {
  if (!(err instanceof Error)) return true;
  const errorRecord = err as unknown as Record<string, unknown>;
  const message = getReadableErrorMessage(err);

  return (
    typeof errorRecord.code === "string" ||
    typeof errorRecord.severity === "string" ||
    typeof errorRecord.routine === "string" ||
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection|database|relation .* does not exist/i.test(message)
  );
}

async function main() {
  const report = await getAuditReport();
  console.log(hasFlag("--json") ? JSON.stringify(report, null, 2) : renderText(report));
}

main()
  .catch((err) => {
    console.error(isLikelyDatabaseFailure(err) ? getDatabaseFailureMessage(err) : getReadableErrorMessage(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
