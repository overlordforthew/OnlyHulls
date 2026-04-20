import { pool, query } from "../src/lib/db/index";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import { classifyGeocodeReviewIssue } from "../src/lib/locations/geocode-triage";
import { resolveLocationCountryHint } from "../src/lib/locations/top-markets";

type ReviewRow = {
  slug: string;
  location_text: string | null;
  location_country: string | null;
  location_region: string | null;
  location_geocode_status: string;
  location_geocode_provider: string | null;
  location_geocode_query: string | null;
  location_geocode_place_name: string | null;
  location_geocode_precision: string | null;
  location_geocode_score: number | null;
  location_geocode_error: string | null;
  location_geocode_attempted_at: string | null;
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getLimit() {
  const parsed = Number(getArgValue("--limit") || DEFAULT_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), MAX_LIMIT) : DEFAULT_LIMIT;
}

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] || 0) + 1;
}

function normalizeAuditValue(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const limit = getLimit();
  const error = getArgValue("--error");
  const status = getArgValue("--status");
  const country = getArgValue("--country");
  const provider = getArgValue("--provider");
  const by = getArgValue("--by") === "row" ? "row" : "query";
  const params: unknown[] = [];
  const filters = [
    "b.status = 'active'",
    buildVisibleImportQualitySql("b"),
    "b.location_geocode_status IN ('review', 'failed')",
  ];

  if (error) {
    params.push(error);
    filters.push(`b.location_geocode_error = $${params.length}`);
  }
  if (status && status !== "both") {
    params.push(status);
    filters.push(`b.location_geocode_status = $${params.length}`);
  }
  if (country) {
    params.push(country);
    filters.push(`LOWER(COALESCE(b.location_country, '')) = LOWER($${params.length})`);
  }
  if (provider) {
    params.push(provider);
    filters.push(`b.location_geocode_provider = $${params.length}`);
  }

  params.push(limit);
  const rows = await query<ReviewRow>(
    `SELECT b.slug,
            b.location_text,
            b.location_country,
            b.location_region,
            b.location_geocode_status,
            b.location_geocode_provider,
            b.location_geocode_query,
            b.location_geocode_place_name,
            b.location_geocode_precision,
            b.location_geocode_score,
            b.location_geocode_error,
            b.location_geocode_attempted_at
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${filters.join(" AND ")}
     ORDER BY
       CASE b.location_geocode_error
         WHEN 'no_result' THEN 0
         WHEN 'low_precision' THEN 1
         WHEN 'low_confidence' THEN 2
         ELSE 3
       END,
       b.location_geocode_attempted_at DESC NULLS LAST,
       b.updated_at DESC,
       b.slug
     LIMIT $${params.length}`,
    params
  );

  const items = rows.map((row) => {
    const countryHint = resolveLocationCountryHint(row.location_text);
    const countryHintMismatch =
      Boolean(countryHint) &&
      normalizeAuditValue(countryHint?.country) !== normalizeAuditValue(row.location_country);
    const triage = classifyGeocodeReviewIssue({
      status: row.location_geocode_status,
      error: row.location_geocode_error,
      precision: row.location_geocode_precision,
      score: row.location_geocode_score,
      placeName: row.location_geocode_place_name,
      countryHintMismatch,
    });

    return {
      slug: row.slug,
      locationText: row.location_text,
      country: row.location_country,
      region: row.location_region,
      status: row.location_geocode_status,
      provider: row.location_geocode_provider,
      query: row.location_geocode_query,
      placeName: row.location_geocode_place_name,
      precision: row.location_geocode_precision,
      score: row.location_geocode_score,
      error: row.location_geocode_error,
      attemptedAt: row.location_geocode_attempted_at,
      countryHint: countryHint
        ? {
            country: countryHint.country,
            region: countryHint.region,
            matchedTerm: countryHint.matchedTerm,
            mismatch: countryHintMismatch,
          }
        : null,
      triage,
      adminUrl: `/boats/${row.slug}`,
    };
  });
  const byCategory: Record<string, number> = {};
  const byError: Record<string, number> = {};
  const byAction: Record<string, number> = {};

  for (const item of items) {
    increment(byCategory, item.triage.category);
    increment(byError, item.error || "unknown");
    increment(byAction, item.triage.action);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    filters: {
      error: error || null,
      status: status || "both",
      country: country || null,
      provider: provider || null,
      by,
      limit,
    },
    count: items.length,
    byCategory,
    byError,
    byAction,
    items: by === "row" ? items : undefined,
    queryGroups: by === "query" ? buildQueryGroups(items) : undefined,
  };

  if (hasFlag("--json")) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Geocode review queue: ${items.length} item${items.length === 1 ? "" : "s"}`);
  console.log(JSON.stringify({ byCategory, byError }, null, 2));
  if (by === "query") {
    for (const item of buildQueryGroups(items)) {
      console.log(
        [
          item.query || "missing query",
          item.error || "unknown",
          `${item.count} rows`,
          item.triage.category,
          item.lastAttemptedAt || "no attempt time",
          item.sampleSlugs.join(", "),
        ].join(" | ")
      );
    }
  } else {
    for (const item of items) {
      console.log(
        [
          item.slug,
          item.status,
          item.error || "unknown",
          item.triage.category,
          item.locationText || "missing location",
          item.triage.action,
        ].join(" | ")
      );
    }
  }
}

function buildQueryGroups(items: Array<{
  slug: string;
  query: string | null;
  error: string | null;
  provider: string | null;
  attemptedAt: string | null;
  triage: ReturnType<typeof classifyGeocodeReviewIssue>;
}>) {
  const groups = new Map<string, {
    query: string | null;
    error: string | null;
    provider: string | null;
    count: number;
    sampleSlugs: string[];
    lastAttemptedAt: string | null;
    triage: ReturnType<typeof classifyGeocodeReviewIssue>;
  }>();

  for (const item of items) {
    const key = [item.query || "missing", item.error || "unknown", item.provider || "unknown"].join("|");
    const group = groups.get(key) || {
      query: item.query,
      error: item.error,
      provider: item.provider,
      count: 0,
      sampleSlugs: [],
      lastAttemptedAt: null,
      triage: item.triage,
    };
    group.count += 1;
    if (group.sampleSlugs.length < 3) group.sampleSlugs.push(item.slug);
    if (
      item.attemptedAt &&
      (!group.lastAttemptedAt || new Date(item.attemptedAt).getTime() > new Date(group.lastAttemptedAt).getTime())
    ) {
      group.lastAttemptedAt = item.attemptedAt;
    }
    groups.set(key, group);
  }

  return Array.from(groups.values()).sort((left, right) => right.count - left.count);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
