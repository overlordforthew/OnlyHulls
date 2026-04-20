import { createHash } from "node:crypto";

import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import { PUBLIC_MAP_PRECISIONS, type PublicMapPrecision } from "@/lib/locations/map-coordinates";

export const MAP_PIN_AUDIT_DEFAULT_LIMIT = 25;
export const MAP_PIN_AUDIT_MAX_LIMIT = 200;
export const MAP_PIN_AUDIT_DEFAULT_BASE_URL = "https://onlyhulls.com";
export const MAP_PIN_AUDIT_ATTESTATION_SCHEMA_VERSION = 1;
export const MAP_PIN_AUDIT_NOTES_MAX_LENGTH = 500;

const BACKUP_TABLE_PATTERN = /^boat_geocode_backup_\d{14}$/;

export type MapPinAuditRow = {
  slug: string;
  title: string;
  locationText: string | null;
  latitude: number;
  longitude: number;
  precision: PublicMapPrecision;
  provider: string | null;
  score: number | null;
  geocodedAt: string | null;
  placeName: string | null;
  auditUrl: string;
  listingUrl: string;
};

export type MapPinAuditReport = {
  generatedAt: string;
  seed: string;
  limit: number;
  eligibleCount: number;
  returnedCount: number;
  precision: PublicMapPrecision | "all";
  backupTable: string | null;
  pins: MapPinAuditRow[];
};

export type MapPinAuditAttestation = {
  schemaVersion: typeof MAP_PIN_AUDIT_ATTESTATION_SCHEMA_VERSION;
  generatedAt: string;
  reviewedAt: string;
  reviewedBy: string;
  sampleSeed: string;
  sampleHash: string;
  sampleLimit: number;
  sampleSize: number;
  acceptedCount: number;
  rejectedCount: number;
  precision: PublicMapPrecision | "all";
  backupTable: string | null;
  notes?: string;
};

export type MapPinAuditWhereInput = {
  precision: PublicMapPrecision | null;
  backupTable: string | null;
};

export type MapPinAuditAttestationInput = {
  reviewedBy: string;
  acceptedCount: number;
  rejectedCount: number;
  reviewedAt?: string;
  notes?: string | null;
};

export function parseMapPinAuditLimit(value?: string | null) {
  const parsed = Number(value || MAP_PIN_AUDIT_DEFAULT_LIMIT);
  if (!Number.isFinite(parsed) || parsed <= 0) return MAP_PIN_AUDIT_DEFAULT_LIMIT;

  return Math.min(Math.floor(parsed), MAP_PIN_AUDIT_MAX_LIMIT);
}

export function parseMapPinAuditPrecision(value?: string | null): PublicMapPrecision | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;

  return PUBLIC_MAP_PRECISIONS.includes(normalized as PublicMapPrecision)
    ? (normalized as PublicMapPrecision)
    : null;
}

export function isSafeGeocodeBackupTableName(value?: string | null) {
  return BACKUP_TABLE_PATTERN.test(String(value || "").trim());
}

function isAllowedAuditBaseHost(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]" ||
    normalized === "onlyhulls.com" ||
    normalized.endsWith(".onlyhulls.com")
  );
}

export function normalizePublicBaseUrl(value?: string | null) {
  const fallback = MAP_PIN_AUDIT_DEFAULT_BASE_URL;
  const raw = String(value || fallback).trim() || fallback;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return fallback;
    }
    if (!isAllowedAuditBaseHost(url.hostname)) {
      return fallback;
    }
    return url.origin;
  } catch {
    return fallback;
  }
}

export function buildMapPinAuditUrl(latitude: number, longitude: number) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`;
}

export function buildMapPinListingUrl(baseUrl: string, slug: string) {
  return `${normalizePublicBaseUrl(baseUrl)}/boats/${encodeURIComponent(slug)}`;
}

function normalizeHashCoordinate(value: number) {
  return Number(value.toFixed(6));
}

export function buildMapPinAuditSampleHash(report: Pick<MapPinAuditReport, "seed" | "limit" | "precision" | "backupTable" | "pins">) {
  const payload = {
    backupTable: report.backupTable,
    limit: report.limit,
    pins: report.pins.map((pin) => ({
      geocodedAt: pin.geocodedAt,
      latitude: normalizeHashCoordinate(pin.latitude),
      longitude: normalizeHashCoordinate(pin.longitude),
      placeName: pin.placeName,
      precision: pin.precision,
      slug: pin.slug,
    })),
    precision: report.precision,
    seed: report.seed,
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function parseMapPinAuditReviewCount(value: string | null, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}. Expected a non-negative integer.`);
  }

  return parsed;
}

export function buildMapPinAuditAttestation(
  report: MapPinAuditReport,
  input: MapPinAuditAttestationInput
): MapPinAuditAttestation {
  const reviewedBy = input.reviewedBy.trim();
  if (!reviewedBy) {
    throw new Error("Missing --reviewed-by. A map pin audit attestation needs an operator handle.");
  }
  if (input.acceptedCount + input.rejectedCount !== report.returnedCount) {
    throw new Error(
      `Accepted plus rejected counts must equal the returned sample size (${report.returnedCount}).`
    );
  }

  const attestation: MapPinAuditAttestation = {
    schemaVersion: MAP_PIN_AUDIT_ATTESTATION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    reviewedAt: input.reviewedAt || new Date().toISOString(),
    reviewedBy,
    sampleSeed: report.seed,
    sampleHash: buildMapPinAuditSampleHash(report),
    sampleLimit: report.limit,
    sampleSize: report.returnedCount,
    acceptedCount: input.acceptedCount,
    rejectedCount: input.rejectedCount,
    precision: report.precision,
    backupTable: report.backupTable,
  };

  const notes = String(input.notes || "").trim();
  if (notes.length > MAP_PIN_AUDIT_NOTES_MAX_LENGTH) {
    throw new Error(`--notes must be ${MAP_PIN_AUDIT_NOTES_MAX_LENGTH} characters or fewer.`);
  }
  if (notes) attestation.notes = notes;

  return attestation;
}

export function buildMapPinAuditWhereSql(input: MapPinAuditWhereInput) {
  const precisionList = input.precision ? [input.precision] : [...PUBLIC_MAP_PRECISIONS];
  const conditions = [
    `b.status = 'active'`,
    buildVisibleImportQualitySql("b"),
    `COALESCE(NULLIF(TRIM(b.slug), ''), '') <> ''`,
    `b.location_lat BETWEEN -90 AND 90`,
    `b.location_lng BETWEEN -180 AND 180`,
    `b.location_geocode_precision = ANY($1::text[])`,
  ];
  const params: unknown[] = [precisionList];

  if (input.backupTable) {
    if (!isSafeGeocodeBackupTableName(input.backupTable)) {
      throw new Error("Invalid --backup-table. Expected boat_geocode_backup_YYYYMMDDHHMMSS.");
    }
    conditions.push(`EXISTS (SELECT 1 FROM public.${input.backupTable} backup WHERE backup.id = b.id)`);
  }

  return {
    params,
    whereSql: conditions.map((condition) => `(${condition})`).join(" AND "),
  };
}
