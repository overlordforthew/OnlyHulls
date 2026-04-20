import fs from "fs";
import path from "path";

import { pool, query } from "../src/lib/db/index";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import {
  buildGeocodeQuery,
  geocodeWithNominatim,
  geocodeWithOpenCage,
  getGeocodingConfig,
  type GeocodeResult,
  type GeocodeStatus,
  type GeocodingProvider,
} from "../src/lib/locations/geocoding";
import {
  buildPinAuditUrl,
  compareGeocodeResults,
  type ComparableGeocodeResult,
} from "../src/lib/locations/geocode-compare";

type BoatLocationRow = {
  location_text: string | null;
  location_country: string | null;
  location_region: string | null;
  location_market_slugs: string[];
  location_confidence: string | null;
};

type PreparedQuery = {
  queryKey: string;
  queryText: string;
  countryHint: string | null;
  rowCount: number;
  expected?: {
    latitude: number;
    longitude: number;
    precision: string;
    source: string | null;
  };
};

type CacheRow = {
  query_key: string;
  query_text: string;
  provider: string;
  status: GeocodeStatus;
  latitude: number | null;
  longitude: number | null;
  precision: string | null;
  score: number | null;
  place_name: string | null;
  payload: unknown;
  error: string | null;
  updated_at: string;
};

type GoldenEntry = {
  id?: string;
  locationText: string;
  country?: string | null;
  region?: string | null;
  expectedLat: number;
  expectedLng: number;
  expectedPrecision: string;
  source?: string | null;
};

const PROVIDERS = ["nominatim", "opencage"] as const;
type ComparedProvider = (typeof PROVIDERS)[number];

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const MAX_NOMINATIM_FETCH_LIMIT = 25;
const MAX_OPENCAGE_FETCH_LIMIT = 200;
const DISAGREEMENT_SAMPLE_LIMIT = 25;
const GOLDEN_SET_PATH = path.join(process.cwd(), "test", "fixtures", "geocode-golden-set.json");

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getPositiveIntArg(name: string, fallback: number, max: number) {
  const parsed = Number(getArgValue(name));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFetchProviders(): ComparedProvider[] {
  if (!hasFlag("--fetch-missing")) return [];
  const provider = String(getArgValue("--provider") || "opencage").toLowerCase();
  if (provider === "both") return [...PROVIDERS];
  return PROVIDERS.includes(provider as ComparedProvider)
    ? [provider as ComparedProvider]
    : ["opencage"];
}

function getMode() {
  const mode = String(getArgValue("--mode") || "").toLowerCase();
  if (mode === "golden" || mode === "random" || mode === "top") {
    return mode;
  }

  return hasFlag("--random") ? "random" : "top";
}

function getFetchLimit(provider: ComparedProvider) {
  const raw = getArgValue("--max-fetches") || getArgValue("--fetch-limit");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const maxLimit =
    provider === "nominatim" ? MAX_NOMINATIM_FETCH_LIMIT : MAX_OPENCAGE_FETCH_LIMIT;

  return Math.min(Math.floor(parsed), maxLimit);
}

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] || 0) + 1;
}

function toComparable(row: CacheRow): ComparableGeocodeResult {
  return {
    provider: row.provider,
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    precision: row.precision,
    score: row.score,
    placeName: row.place_name,
    payload: row.payload,
    error: row.error,
  };
}

function fromResult(result: GeocodeResult): ComparableGeocodeResult {
  return {
    provider: result.provider,
    status: result.status,
    latitude: result.latitude,
    longitude: result.longitude,
    precision: result.precision,
    score: result.score,
    placeName: result.placeName,
    payload: result.payload,
    error: result.error,
  };
}

function isProvider(value: string): value is ComparedProvider {
  return value === "nominatim" || value === "opencage";
}

async function loadGeocodableQueries(selectionMode: string) {
  const rows = await query<BoatLocationRow>(
    `SELECT b.location_text,
            b.location_country,
            b.location_region,
            COALESCE(b.location_market_slugs, '{}') AS location_market_slugs,
            b.location_confidence
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}
       AND COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> ''`
  );
  const byQuery = new Map<string, PreparedQuery>();

  for (const row of rows) {
    const geocodeQuery = buildGeocodeQuery({
      locationText: row.location_text,
      country: row.location_country,
      region: row.location_region,
      marketSlugs: row.location_market_slugs,
      confidence: row.location_confidence,
    });
    if (!geocodeQuery) continue;

    const current = byQuery.get(geocodeQuery.queryKey);
    if (current) {
      current.rowCount += 1;
      continue;
    }
    byQuery.set(geocodeQuery.queryKey, {
      queryKey: geocodeQuery.queryKey,
      queryText: geocodeQuery.queryText,
      countryHint: geocodeQuery.countryHint,
      rowCount: 1,
    });
  }

  const queries = Array.from(byQuery.values());
  if (selectionMode === "random") {
    return queries.sort(() => Math.random() - 0.5);
  }

  return queries.sort((left, right) => right.rowCount - left.rowCount || left.queryText.localeCompare(right.queryText));
}

function loadGoldenQueries() {
  if (!fs.existsSync(GOLDEN_SET_PATH)) return [];
  const parsed = JSON.parse(fs.readFileSync(GOLDEN_SET_PATH, "utf8")) as GoldenEntry[];
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry): PreparedQuery[] => {
    const geocodeQuery = buildGeocodeQuery({
      locationText: entry.locationText,
      country: entry.country,
      region: entry.region,
      confidence: "exact",
    });
    if (!geocodeQuery) return [];

    return [{
      queryKey: geocodeQuery.queryKey,
      queryText: geocodeQuery.queryText,
      countryHint: geocodeQuery.countryHint,
      rowCount: 1,
      expected: {
        latitude: entry.expectedLat,
        longitude: entry.expectedLng,
        precision: entry.expectedPrecision,
        source: entry.source || null,
      },
    }];
  });
}

async function loadCache(queryKeys: string[]) {
  const cache = new Map<string, Map<ComparedProvider, ComparableGeocodeResult>>();
  if (queryKeys.length === 0) return cache;

  const rows = await query<CacheRow>(
    `SELECT query_key,
            query_text,
            provider,
            status,
            latitude,
            longitude,
            precision,
            score,
            place_name,
            payload,
            error,
            updated_at
     FROM location_geocode_cache
     WHERE query_key = ANY($1::text[])
       AND provider = ANY($2::text[])`,
    [queryKeys, [...PROVIDERS]]
  );

  for (const row of rows) {
    if (!isProvider(row.provider)) continue;
    const providerCache = cache.get(row.query_key) || new Map<ComparedProvider, ComparableGeocodeResult>();
    providerCache.set(row.provider, toComparable(row));
    cache.set(row.query_key, providerCache);
  }

  return cache;
}

async function cacheResult(queryKey: string, queryText: string, result: GeocodeResult) {
  if (result.status === "skipped") return;

  await query(
    `INSERT INTO location_geocode_cache (
       query_key, query_text, provider, status, latitude, longitude, precision,
       score, place_name, payload, error, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (query_key, provider)
     DO UPDATE SET query_text = EXCLUDED.query_text,
                   status = EXCLUDED.status,
                   latitude = EXCLUDED.latitude,
                   longitude = EXCLUDED.longitude,
                   precision = EXCLUDED.precision,
                   score = EXCLUDED.score,
                   place_name = EXCLUDED.place_name,
                   payload = EXCLUDED.payload,
                   error = EXCLUDED.error,
                   updated_at = NOW()`,
    [
      queryKey,
      queryText,
      result.provider,
      result.status,
      result.latitude,
      result.longitude,
      result.precision,
      result.score,
      result.placeName,
      JSON.stringify(result.payload || null),
      result.error || null,
    ]
  );
}

async function fetchWithProvider(provider: ComparedProvider, preparedQuery: PreparedQuery) {
  const config = getGeocodingConfig(provider as GeocodingProvider);
  switch (provider) {
    case "nominatim":
      return geocodeWithNominatim(preparedQuery, config);
    case "opencage":
      return geocodeWithOpenCage(preparedQuery, config);
  }
}

async function fetchMissing(
  selectedQueries: PreparedQuery[],
  cache: Map<string, Map<ComparedProvider, ComparableGeocodeResult>>,
  fetchProviders: ComparedProvider[]
) {
  const fetched: Record<string, number> = {};
  const skipped: string[] = [];

  for (const provider of fetchProviders) {
    if (provider === "nominatim" && !hasFlag("--allow-nominatim")) {
      skipped.push("nominatim_requires_--allow-nominatim");
      continue;
    }

    const config = getGeocodingConfig(provider as GeocodingProvider);
    const fetchLimit = getFetchLimit(provider);
    if (fetchLimit === null) {
      skipped.push(`${provider}_requires_--max-fetches`);
      continue;
    }
    if (provider === "nominatim" && !String(config.userAgent || "").includes("@")) {
      skipped.push("nominatim_requires_contact_email_in_user_agent");
      continue;
    }
    if (!config.enabled) {
      skipped.push(`${provider}_not_configured`);
      continue;
    }

    let fetchedForProvider = 0;
    for (const preparedQuery of selectedQueries) {
      if (fetchedForProvider >= fetchLimit) break;
      const providerCache = cache.get(preparedQuery.queryKey);
      if (providerCache?.has(provider)) continue;

      const result = await fetchWithProvider(provider, preparedQuery);
      await cacheResult(preparedQuery.queryKey, preparedQuery.queryText, result);
      const nextCache = cache.get(preparedQuery.queryKey) || new Map<ComparedProvider, ComparableGeocodeResult>();
      nextCache.set(provider, fromResult(result));
      cache.set(preparedQuery.queryKey, nextCache);
      fetchedForProvider += 1;
      fetched[provider] = (fetched[provider] || 0) + 1;

      if (config.delayMs > 0) await sleep(config.delayMs);
    }
  }

  return { fetched, skipped };
}

async function main() {
  const limit = getPositiveIntArg("--limit", DEFAULT_LIMIT, MAX_LIMIT);
  const mode = getMode();
  const fetchProviders = getFetchProviders();
  const allQueries = mode === "golden" ? loadGoldenQueries() : await loadGeocodableQueries(mode);
  const selectedQueries = allQueries.slice(0, limit);
  const cache = await loadCache(selectedQueries.map((row) => row.queryKey));
  const fetchSummary = await fetchMissing(selectedQueries, cache, fetchProviders);
  const missingByProvider: Record<string, number> = {};
  const statusByProvider: Record<string, Record<string, number>> = {};
  const precisionDisagreements: Record<string, number> = {};
  const distanceBuckets: Record<string, number> = {
    under_1km: 0,
    under_10km: 0,
    over_10km: 0,
    not_comparable: 0,
  };
  const disagreementSamples: Array<Record<string, unknown>> = [];
  const providerGoldenDistances: Record<string, number[]> = {};
  const providerGoldenPrecision: Record<string, { matched: number; total: number }> = {};

  let comparableCount = 0;
  let countryMismatchCount = 0;
  let precisionMismatchCount = 0;

  for (const preparedQuery of selectedQueries) {
    const providerCache = cache.get(preparedQuery.queryKey) || new Map<ComparedProvider, ComparableGeocodeResult>();
    const nominatim = providerCache.get("nominatim") || null;
    const openCage = providerCache.get("opencage") || null;

    for (const provider of PROVIDERS) {
      const result = providerCache.get(provider);
      if (!result) {
        increment(missingByProvider, provider);
        increment(statusByProvider[provider] || (statusByProvider[provider] = {}), "missing");
        continue;
      }
      increment(statusByProvider[provider] || (statusByProvider[provider] = {}), result.status);
    }

    const comparison = compareGeocodeResults(nominatim, openCage);
    increment(distanceBuckets, comparison.distanceBucket);
    if (!comparison.comparable) continue;

    comparableCount += 1;
    if (comparison.precisionAgreement === false) {
      precisionMismatchCount += 1;
      increment(precisionDisagreements, `${nominatim?.precision || "unknown"}_vs_${openCage?.precision || "unknown"}`);
    }
    if (comparison.countryAgreement === false) countryMismatchCount += 1;

    const shouldSample =
      comparison.distanceBucket === "over_10km" ||
      comparison.precisionAgreement === false ||
      comparison.countryAgreement === false;
    if (shouldSample && disagreementSamples.length < DISAGREEMENT_SAMPLE_LIMIT) {
      disagreementSamples.push({
        queryText: preparedQuery.queryText,
        rowCount: preparedQuery.rowCount,
        distanceKm: comparison.distanceKm === null ? null : Number(comparison.distanceKm.toFixed(3)),
        precisionAgreement: comparison.precisionAgreement,
        countryAgreement: comparison.countryAgreement,
        nominatim: nominatim && {
          status: nominatim.status,
          latitude: nominatim.latitude,
          longitude: nominatim.longitude,
          precision: nominatim.precision,
          score: nominatim.score,
          placeName: nominatim.placeName,
          error: nominatim.error,
          auditUrl: buildPinAuditUrl(nominatim.latitude, nominatim.longitude),
        },
        openCage: openCage && {
          status: openCage.status,
          latitude: openCage.latitude,
          longitude: openCage.longitude,
          precision: openCage.precision,
          score: openCage.score,
          placeName: openCage.placeName,
          error: openCage.error,
          auditUrl: buildPinAuditUrl(openCage.latitude, openCage.longitude),
        },
      });
    }

    if (mode === "golden" && preparedQuery.expected) {
      for (const provider of PROVIDERS) {
        const result = providerCache.get(provider);
        if (!result || result.status !== "geocoded" || typeof result.latitude !== "number" || typeof result.longitude !== "number") {
          continue;
        }
        const truth = preparedQuery.expected;
        const truthComparison = compareGeocodeResults(
          {
            provider: "golden",
            status: "geocoded",
            latitude: truth.latitude,
            longitude: truth.longitude,
            precision: truth.precision,
            score: 1,
            placeName: truth.source,
          },
          result
        );
        if (truthComparison.distanceKm !== null) {
          providerGoldenDistances[provider] = providerGoldenDistances[provider] || [];
          providerGoldenDistances[provider].push(truthComparison.distanceKm);
        }
        providerGoldenPrecision[provider] = providerGoldenPrecision[provider] || { matched: 0, total: 0 };
        providerGoldenPrecision[provider].total += 1;
        if (result.precision === truth.precision) providerGoldenPrecision[provider].matched += 1;
      }
    }
  }

  const within10km = (distanceBuckets.under_1km || 0) + (distanceBuckets.under_10km || 0);
  const agreementRate = comparableCount > 0
    ? Number(((within10km / comparableCount) * 100).toFixed(2))
    : 0;
  const goldenSummaries = Object.fromEntries(
    PROVIDERS.map((provider) => {
      const distances = (providerGoldenDistances[provider] || []).sort((left, right) => left - right);
      const precision = providerGoldenPrecision[provider] || { matched: 0, total: 0 };
      const median = distances.length > 0
        ? distances[Math.floor((distances.length - 1) / 2)]
        : null;
      const precisionMatchRate = precision.total > 0
        ? Number(((precision.matched / precision.total) * 100).toFixed(2))
        : null;

      return [provider, {
        sampleCount: distances.length,
        medianDistanceKm: median === null ? null : Number(median.toFixed(3)),
        precisionMatchRate,
      }];
    })
  );
  const openCageGolden = goldenSummaries.opencage;
  const goldenAccuracy = mode === "golden"
    ? {
        status:
          selectedQueries.length > 0 &&
          openCageGolden.sampleCount > 0 &&
          openCageGolden.medianDistanceKm !== null &&
          openCageGolden.medianDistanceKm <= 1 &&
          (openCageGolden.precisionMatchRate || 0) >= 80
            ? "passing"
            : "failing",
        providerSummaries: goldenSummaries,
        medianDistanceKm: openCageGolden.medianDistanceKm,
        precisionMatchRate: openCageGolden.precisionMatchRate,
      }
    : null;

  const artifact = {
    generatedAt: new Date().toISOString(),
    mode: fetchProviders.length > 0 ? "fetch-missing" : "cached-only",
    selection: mode,
    totalGeocodableQueries: allQueries.length,
    selectedQueryCount: selectedQueries.length,
    selectedListingRows: selectedQueries.reduce((sum, row) => sum + row.rowCount, 0),
    fetch: fetchSummary,
    cache: {
      missingByProvider,
      statusByProvider,
    },
    comparison: {
      comparableCount,
      agreementWithin10kmCount: within10km,
      agreementWithin10kmRate: agreementRate,
      distanceBuckets,
      precisionMismatchCount,
      precisionDisagreements,
      countryMismatchCount,
    },
    goldenAccuracy,
    disagreementSamples,
    nextRecommendedCommand:
      fetchProviders.length === 0
        ? "npm run db:geocode-compare -- --limit=100 --fetch-missing --provider=opencage --max-fetches=10"
        : "npm run db:geocode-readiness",
  };

  if (hasFlag("--write-artifact")) {
    const artifactPath =
      process.env.GEOCODE_COMPARE_ARTIFACT ||
      path.join(process.cwd(), "tmp", "geocode-compare-latest.json");
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  }

  console.log(JSON.stringify(artifact, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
