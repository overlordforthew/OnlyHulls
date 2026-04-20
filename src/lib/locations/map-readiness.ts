export type MapReadinessThresholds = {
  minMarketTaggedPct: number;
  minCityOrBetterPct: number;
  minPublicPinPct: number;
  minNonApproxPublicPinPct: number;
  maxReviewFailedPct: number;
};

export type MapReadinessSummaryRow = {
  active_visible_count?: string | number | null;
  with_location_text_count?: string | number | null;
  with_market_slugs_count?: string | number | null;
  city_or_better_count?: string | number | null;
  public_pin_count?: string | number | null;
  non_approx_public_pin_count?: string | number | null;
  raw_coordinate_count?: string | number | null;
  city_coordinate_count?: string | number | null;
  regional_coordinate_count?: string | number | null;
  approximate_public_pin_count?: string | number | null;
  pending_count?: string | number | null;
  geocoded_count?: string | number | null;
  review_count?: string | number | null;
  failed_count?: string | number | null;
  skipped_count?: string | number | null;
  invalid_public_coordinate_count?: string | number | null;
  public_missing_metadata_count?: string | number | null;
  stale_public_coordinate_count?: string | number | null;
  low_score_public_pin_count?: string | number | null;
};

export type MapReadinessSplitRow = {
  label?: string | null;
  count?: string | number | null;
};

export type MapReadinessSnapshotInput = {
  summary?: MapReadinessSummaryRow | null;
  precisionRows?: MapReadinessSplitRow[];
  statusRows?: MapReadinessSplitRow[];
  providerRows?: MapReadinessSplitRow[];
  thresholds?: Partial<MapReadinessThresholds>;
  geocodingEnabled: boolean;
  geocodingProvider: string;
  publicMapEnabled: boolean;
  generatedAt?: string;
};

export type MapReadinessSplit = {
  label: string;
  count: number;
  percentOfVisible: number;
};

export type MapReadinessSnapshot = {
  generatedAt: string;
  launchReady: boolean;
  publicMapEnabled: boolean;
  geocoding: {
    enabled: boolean;
    provider: string;
  };
  thresholds: MapReadinessThresholds;
  blockers: string[];
  summary: {
    activeVisibleCount: number;
    withLocationTextCount: number;
    withMarketSlugsCount: number;
    cityOrBetterCount: number;
    publicPinCount: number;
    nonApproxPublicPinCount: number;
    rawCoordinateCount: number;
    cityCoordinateCount: number;
    regionalCoordinateCount: number;
    approximatePublicPinCount: number;
    pendingCount: number;
    geocodedCount: number;
    reviewCount: number;
    failedCount: number;
    skippedCount: number;
    invalidPublicCoordinateCount: number;
    publicMissingMetadataCount: number;
    stalePublicCoordinateCount: number;
    lowScorePublicPinCount: number;
  };
  rates: {
    locationTextPct: number;
    marketTaggedPct: number;
    cityOrBetterPct: number;
    publicPinPct: number;
    nonApproxPublicPinPct: number;
    reviewFailedPct: number;
    stalePublicPinPct: number;
    lowScorePublicPinPct: number;
  };
  splits: {
    precision: MapReadinessSplit[];
    status: MapReadinessSplit[];
    provider: MapReadinessSplit[];
  };
};

const DEFAULT_THRESHOLDS: MapReadinessThresholds = {
  minMarketTaggedPct: 95,
  minCityOrBetterPct: 85,
  minPublicPinPct: 85,
  minNonApproxPublicPinPct: 50,
  maxReviewFailedPct: 0,
};

function parseCount(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function parsePercent(value: string | undefined, fallback: number) {
  if (value === undefined || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : fallback;
}

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 10_000) / 100;
}

function buildSplit(rows: MapReadinessSplitRow[] | undefined, total: number): MapReadinessSplit[] {
  return (rows || [])
    .map((row) => {
      const label = String(row.label || "none").trim() || "none";
      const count = parseCount(row.count);
      return {
        label,
        count,
        percentOfVisible: pct(count, total),
      };
    })
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function getMapReadinessThresholds(
  env: Record<string, string | undefined> = process.env
): MapReadinessThresholds {
  return {
    minMarketTaggedPct: parsePercent(
      env.MAP_READINESS_MIN_MARKET_TAG_PCT,
      DEFAULT_THRESHOLDS.minMarketTaggedPct
    ),
    minCityOrBetterPct: parsePercent(
      env.MAP_READINESS_MIN_CITY_OR_BETTER_PCT,
      DEFAULT_THRESHOLDS.minCityOrBetterPct
    ),
    minPublicPinPct: parsePercent(
      env.MAP_READINESS_MIN_PUBLIC_PIN_PCT,
      DEFAULT_THRESHOLDS.minPublicPinPct
    ),
    minNonApproxPublicPinPct: parsePercent(
      env.MAP_READINESS_MIN_NON_APPROX_PUBLIC_PIN_PCT,
      DEFAULT_THRESHOLDS.minNonApproxPublicPinPct
    ),
    maxReviewFailedPct: parsePercent(
      env.MAP_READINESS_MAX_REVIEW_FAILED_PCT,
      DEFAULT_THRESHOLDS.maxReviewFailedPct
    ),
  };
}

export function buildMapReadinessSnapshot(
  input: MapReadinessSnapshotInput
): MapReadinessSnapshot {
  const thresholds = {
    ...getMapReadinessThresholds(),
    ...(input.thresholds || {}),
  };
  const summaryRow = input.summary || {};
  const activeVisibleCount = parseCount(summaryRow.active_visible_count);
  const withLocationTextCount = parseCount(summaryRow.with_location_text_count);
  const withMarketSlugsCount = parseCount(summaryRow.with_market_slugs_count);
  const cityOrBetterCount = parseCount(summaryRow.city_or_better_count);
  const publicPinCount = parseCount(summaryRow.public_pin_count);
  const nonApproxPublicPinCount = parseCount(summaryRow.non_approx_public_pin_count);
  const rawCoordinateCount = parseCount(summaryRow.raw_coordinate_count);
  const cityCoordinateCount = parseCount(summaryRow.city_coordinate_count);
  const regionalCoordinateCount = parseCount(summaryRow.regional_coordinate_count);
  const approximatePublicPinCount = parseCount(summaryRow.approximate_public_pin_count);
  const pendingCount = parseCount(summaryRow.pending_count);
  const geocodedCount = parseCount(summaryRow.geocoded_count);
  const reviewCount = parseCount(summaryRow.review_count);
  const failedCount = parseCount(summaryRow.failed_count);
  const skippedCount = parseCount(summaryRow.skipped_count);
  const invalidPublicCoordinateCount = parseCount(summaryRow.invalid_public_coordinate_count);
  const publicMissingMetadataCount = parseCount(summaryRow.public_missing_metadata_count);
  const stalePublicCoordinateCount = parseCount(summaryRow.stale_public_coordinate_count);
  const lowScorePublicPinCount = parseCount(summaryRow.low_score_public_pin_count);
  const reviewFailedCount = reviewCount + failedCount;

  const rates = {
    locationTextPct: pct(withLocationTextCount, activeVisibleCount),
    marketTaggedPct: pct(withMarketSlugsCount, activeVisibleCount),
    cityOrBetterPct: pct(cityOrBetterCount, activeVisibleCount),
    publicPinPct: pct(publicPinCount, activeVisibleCount),
    nonApproxPublicPinPct: pct(nonApproxPublicPinCount, activeVisibleCount),
    reviewFailedPct: pct(reviewFailedCount, activeVisibleCount),
    stalePublicPinPct: pct(stalePublicCoordinateCount, publicPinCount),
    lowScorePublicPinPct: pct(lowScorePublicPinCount, publicPinCount),
  };

  const blockers: string[] = [];
  if (activeVisibleCount === 0) blockers.push("no active visible listings");
  if (!input.geocodingEnabled) blockers.push("geocoder is not configured");
  if (rates.marketTaggedPct < thresholds.minMarketTaggedPct) {
    blockers.push(`market tags below ${thresholds.minMarketTaggedPct}%`);
  }
  if (rates.cityOrBetterPct < thresholds.minCityOrBetterPct) {
    blockers.push(`city-or-better locations below ${thresholds.minCityOrBetterPct}%`);
  }
  if (rates.publicPinPct < thresholds.minPublicPinPct) {
    blockers.push(`public pins below ${thresholds.minPublicPinPct}%`);
  }
  if (rates.nonApproxPublicPinPct < thresholds.minNonApproxPublicPinPct) {
    blockers.push(`non-approx public pins below ${thresholds.minNonApproxPublicPinPct}%`);
  }
  if (rates.reviewFailedPct > thresholds.maxReviewFailedPct) {
    blockers.push(`review/failed geocodes above ${thresholds.maxReviewFailedPct}%`);
  }
  if (invalidPublicCoordinateCount > 0) {
    blockers.push(`${invalidPublicCoordinateCount.toLocaleString()} invalid public coordinate rows`);
  }
  if (publicMissingMetadataCount > 0) {
    blockers.push(`${publicMissingMetadataCount.toLocaleString()} public pins missing metadata`);
  }

  return {
    generatedAt: input.generatedAt || new Date().toISOString(),
    launchReady: blockers.length === 0,
    publicMapEnabled: input.publicMapEnabled,
    geocoding: {
      enabled: input.geocodingEnabled,
      provider: input.geocodingProvider || "disabled",
    },
    thresholds,
    blockers,
    summary: {
      activeVisibleCount,
      withLocationTextCount,
      withMarketSlugsCount,
      cityOrBetterCount,
      publicPinCount,
      nonApproxPublicPinCount,
      rawCoordinateCount,
      cityCoordinateCount,
      regionalCoordinateCount,
      approximatePublicPinCount,
      pendingCount,
      geocodedCount,
      reviewCount,
      failedCount,
      skippedCount,
      invalidPublicCoordinateCount,
      publicMissingMetadataCount,
      stalePublicCoordinateCount,
      lowScorePublicPinCount,
    },
    rates,
    splits: {
      precision: buildSplit(input.precisionRows, activeVisibleCount),
      status: buildSplit(input.statusRows, activeVisibleCount),
      provider: buildSplit(input.providerRows, activeVisibleCount),
    },
  };
}
