import fs from "fs";
import path from "path";

import { pool } from "../src/lib/db";
import { PUBLIC_MAP_PRECISIONS } from "../src/lib/locations/map-coordinates";
import { getMapPinAuditReport } from "../src/lib/locations/map-pin-audit-data";
import {
  buildMapPinAuditAttestation,
  isSafeGeocodeBackupTableName,
  normalizePublicBaseUrl,
  parseMapPinAuditLimit,
  parseMapPinAuditPrecision,
  parseMapPinAuditReviewCount,
  type MapPinAuditReport,
} from "../src/lib/locations/map-pin-audit";

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

function getEmitReportPath() {
  return getArgValue("--emit-report");
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

async function getAuditReport(): Promise<MapPinAuditReport> {
  const limit = parseMapPinAuditLimit(getArgValue("--limit"));
  const seed = getSeed();
  const baseUrl = getBaseUrl();
  const precision = assertPrecision(getArgValue("--precision"));
  const backupTable = assertBackupTable(getArgValue("--backup-table"));
  return getMapPinAuditReport({ backupTable, baseUrl, limit, precision, seed });
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

function writeJsonFile(filePath: string, value: unknown) {
  const resolved = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return resolved;
}

function buildAttestation(report: MapPinAuditReport) {
  const reviewedBy = getArgValue("--reviewed-by") || "";
  const acceptedCount = parseMapPinAuditReviewCount(getArgValue("--accepted"), "--accepted");
  const rejectedCount = parseMapPinAuditReviewCount(getArgValue("--rejected"), "--rejected");
  return buildMapPinAuditAttestation(report, {
    acceptedCount,
    rejectedCount,
    notes: getArgValue("--notes"),
    reviewedAt: getArgValue("--reviewed-at") || undefined,
    reviewedBy,
  });
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
  if (hasFlag("--attest")) {
    const emitReportPath = getEmitReportPath();
    if (!emitReportPath) {
      throw new Error("Missing --emit-report=path.json for --attest.");
    }
    const attestation = buildAttestation(report);
    const resolvedPath = writeJsonFile(emitReportPath, attestation);
    if (hasFlag("--json")) {
      console.log(JSON.stringify(attestation, null, 2));
    } else {
      console.log(`Map pin audit attestation written: ${resolvedPath}`);
      console.log(`Sample: ${attestation.sampleSize} pins, rejected: ${attestation.rejectedCount}`);
    }
    return;
  }

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
