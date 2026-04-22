import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

import { pool, query } from "../src/lib/db";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import { classifyGeocodeReviewIssue } from "../src/lib/locations/geocode-triage";
import {
  analyzeLocationBacklogRow,
  getSourceCleanupPatternMatchesForTexts,
  normalizeLocationBacklogText,
  SOURCE_CLEANUP_PATTERNS,
  type LocationBacklogAnalysisResult,
  type LocationBacklogBucket,
  type LocationBacklogIntervention,
} from "../src/lib/locations/location-backlog-analysis";
import { buildGeocodeQuery, getGeocodeCandidateReason, type GeocodePrecision } from "../src/lib/locations/geocoding";
import { PUBLIC_MAP_PRECISIONS } from "../src/lib/locations/map-coordinates";
import { resolveLocationCountryHint } from "../src/lib/locations/top-markets";

type BacklogRow = {
  id: string;
  slug: string;
  source_site: string | null;
  source_name: string | null;
  location_text: string | null;
  location_country: string | null;
  location_region: string | null;
  location_market_slugs: string[] | null;
  location_confidence: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_geocode_status: string | null;
  location_geocode_query: string | null;
  location_geocode_place_name: string | null;
  location_geocode_precision: GeocodePrecision | string | null;
  location_geocode_score: number | null;
  location_geocode_error: string | null;
};

type EnrichedBacklogRow = BacklogRow & {
  candidateReason: string;
  queryText: string | null;
  countryHint: string | null;
  countryHintMismatch: boolean;
  hasValidCoordinates: boolean;
  analysis: LocationBacklogAnalysisResult;
  triage: ReturnType<typeof classifyGeocodeReviewIssue> | null;
};

type CountEntry = {
  label: string;
  count: number;
};

type ClusterEntry = {
  key: string;
  label: string;
  bucket: LocationBacklogBucket;
  intervention: LocationBacklogIntervention;
  rowCount: number;
  estimatedActionableLift: number;
  probability: number;
  countries: CountEntry[];
  sources: CountEntry[];
  sampleSlugs: string[];
  sampleLocations: string[];
  rationale: string;
};

const ACTIVE_VISIBLE_SQL = `
  b.status = 'active'
  AND ${buildVisibleImportQualitySql("b")}
`;

const DEFAULT_TOP = 30;
const MAX_TOP = 200;

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function parseTop() {
  const parsed = Number(getArgValue("--top") || DEFAULT_TOP);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), MAX_TOP) : DEFAULT_TOP;
}

function getStamp() {
  const stamp = getArgValue("--stamp") || new Date().toISOString().slice(0, 10);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/.test(stamp)) {
    throw new Error("Invalid --stamp. Use only letters, numbers, dots, underscores, and dashes.");
  }
  return stamp;
}

function getOutputDir() {
  return getArgValue("--output-dir") || path.join("reports", "location-backlog");
}

function getGitValue(args: string[]) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function getRunMetadata(generatedAt: string) {
  return {
    generatedAt,
    gitSha: getGitValue(["rev-parse", "HEAD"]),
    gitBranch: getGitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
    publicMapEnabled: process.env.PUBLIC_MAP_ENABLED || null,
    nextPublicMapEnabled: process.env.NEXT_PUBLIC_MAP_ENABLED || null,
    nodeEnv: process.env.NODE_ENV || null,
  };
}

function increment(record: Record<string, number>, key: string, amount = 1) {
  record[key] = (record[key] || 0) + amount;
}

function toSortedEntries(record: Record<string, number>, limit = DEFAULT_TOP): CountEntry[] {
  return Object.entries(record)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function validCoordinate(latitude: number | null, longitude: number | null) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function getCountryLabel(row: BacklogRow) {
  return row.location_country?.trim() || "Unknown";
}

function getSourceLabel(row: BacklogRow) {
  return row.source_name?.trim() || row.source_site?.trim() || "Platform";
}

function getCandidate(row: BacklogRow) {
  const candidate = {
    locationText: row.location_text,
    country: row.location_country,
    region: row.location_region,
    marketSlugs: row.location_market_slugs || [],
    confidence: row.location_confidence,
  };

  return {
    reason: getGeocodeCandidateReason(candidate),
    query: buildGeocodeQuery(candidate),
  };
}

function getCountryHintMismatch(row: BacklogRow) {
  const countryHint = resolveLocationCountryHint(row.location_text);
  if (!countryHint) return false;

  return (
    normalizeLocationBacklogText(countryHint.country) !== normalizeLocationBacklogText(row.location_country)
  );
}

function enrichRow(row: BacklogRow): EnrichedBacklogRow {
  const candidate = getCandidate(row);
  const hasValidCoordinates = validCoordinate(row.location_lat, row.location_lng);
  const countryHintMismatch = getCountryHintMismatch(row);
  const triage =
    row.location_geocode_status === "review" || row.location_geocode_status === "failed"
      ? classifyGeocodeReviewIssue({
          status: row.location_geocode_status,
          error: row.location_geocode_error,
          precision: row.location_geocode_precision,
          score: row.location_geocode_score,
          placeName: row.location_geocode_place_name,
          countryHintMismatch,
        })
      : null;
  const queryText = candidate.query?.queryText || row.location_geocode_query || null;
  const analysis = analyzeLocationBacklogRow({
    status: row.location_geocode_status,
    precision: row.location_geocode_precision,
    hasValidCoordinates,
    candidateReason: candidate.reason,
    locationText: row.location_text,
    queryText,
    error: row.location_geocode_error,
    triageCategory: triage?.category,
  });

  return {
    ...row,
    candidateReason: candidate.reason,
    queryText,
    countryHint: candidate.query?.countryHint || null,
    countryHintMismatch,
    hasValidCoordinates,
    analysis,
    triage,
  };
}

function buildClusterEntries(
  rows: EnrichedBacklogRow[],
  top: number,
  options: { excludeInterventions?: LocationBacklogIntervention[] } = {}
) {
  const excludedInterventions = new Set<LocationBacklogIntervention>([
    ...(options.excludeInterventions || []),
  ]);
  const grouped = new Map<string, {
    analysis: LocationBacklogAnalysisResult;
    rows: EnrichedBacklogRow[];
    countries: Record<string, number>;
    sources: Record<string, number>;
    locations: Set<string>;
    slugs: string[];
  }>();

  for (const row of rows) {
    const analysis = row.analysis;
    if (excludedInterventions.has(analysis.intervention)) continue;

    const existing = grouped.get(analysis.clusterKey) || {
      analysis,
      rows: [],
      countries: {},
      sources: {},
      locations: new Set<string>(),
      slugs: [],
    };

    existing.rows.push(row);
    increment(existing.countries, getCountryLabel(row));
    increment(existing.sources, getSourceLabel(row));
    if (row.location_text && existing.locations.size < 5) existing.locations.add(row.location_text);
    if (existing.slugs.length < 5) existing.slugs.push(row.slug);
    grouped.set(analysis.clusterKey, existing);
  }

  return Array.from(grouped.entries())
    .map(([key, group]): ClusterEntry => {
      const rowCount = group.rows.length;
      const probability = group.analysis.interventionProbability;
      return {
        key,
        label: group.analysis.clusterLabel,
        bucket: group.analysis.bucket,
        intervention: group.analysis.intervention,
        rowCount,
        estimatedActionableLift: Number((rowCount * probability).toFixed(1)),
        probability,
        countries: toSortedEntries(group.countries, 5),
        sources: toSortedEntries(group.sources, 5),
        sampleSlugs: group.slugs,
        sampleLocations: [...group.locations],
        rationale: group.analysis.rationale,
      };
    })
    .sort(
      (left, right) =>
        right.estimatedActionableLift - left.estimatedActionableLift ||
        right.rowCount - left.rowCount ||
        left.label.localeCompare(right.label)
    )
    .slice(0, top);
}

function buildQueryFrequency(rows: EnrichedBacklogRow[], top: number) {
  const counts: Record<string, number> = {};
  const samples = new Map<string, string[]>();

  for (const row of rows) {
    const label = row.queryText || row.location_text || "missing query";
    increment(counts, label);
    const sample = samples.get(label) || [];
    if (sample.length < 3) sample.push(row.slug);
    samples.set(label, sample);
  }

  return toSortedEntries(counts, top).map((entry) => ({
    ...entry,
    sampleSlugs: samples.get(entry.label) || [],
  }));
}

function buildGazetteerSeeds(rows: EnrichedBacklogRow[], top: number) {
  const groups = new Map<string, {
    name: string;
    country: string;
    rows: EnrichedBacklogRow[];
    intervention: LocationBacklogIntervention;
  }>();

  for (const row of rows) {
    if (row.analysis.intervention !== "search_coverage_batch") continue;

    const name = row.analysis.clusterLabel;
    if (!name) continue;

    const country = getCountryLabel(row);
    const key = `${normalizeLocationBacklogText(name)}|${normalizeLocationBacklogText(country)}`;
    const group = groups.get(key) || {
      name,
      country,
      rows: [],
      intervention: row.analysis.intervention,
    };
    group.rows.push(row);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      name: group.name,
      country: group.country,
      rowCount: group.rows.length,
      intervention: group.intervention,
      sampleSlugs: group.rows.slice(0, 5).map((row) => row.slug),
      sampleQueries: Array.from(new Set(group.rows.map((row) => row.queryText || row.location_text || "")))
        .filter(Boolean)
        .slice(0, 3),
    }))
    .sort((left, right) => right.rowCount - left.rowCount || left.name.localeCompare(right.name))
    .slice(0, top);
}

function buildCleanupCandidates(rows: EnrichedBacklogRow[], top: number) {
  const groups = new Map<string, {
    patternId: string;
    label: string;
    recommendation: string;
    rows: EnrichedBacklogRow[];
  }>();

  for (const row of rows) {
    if (row.analysis.intervention !== "source_cleanup_rule") continue;

    const matches = getSourceCleanupPatternMatchesForTexts(row.location_text, row.queryText);
    for (const match of matches) {
      const group = groups.get(match.id) || {
        patternId: match.id,
        label: match.label,
        recommendation: match.recommendation,
        rows: [],
      };
      group.rows.push(row);
      groups.set(match.id, group);
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      patternId: group.patternId,
      label: group.label,
      rowCount: group.rows.length,
      recommendation: group.recommendation,
      sampleLocations: Array.from(new Set(group.rows.map((row) => row.location_text || "")))
        .filter(Boolean)
        .slice(0, 5),
      sampleSlugs: group.rows.slice(0, 5).map((row) => row.slug),
    }))
    .sort((left, right) => right.rowCount - left.rowCount || left.label.localeCompare(right.label))
    .slice(0, top);
}

function buildManualEnrichmentDedup(rows: EnrichedBacklogRow[], top: number) {
  const manualRows = rows.filter((row) => row.triage?.category === "manual_enrichment");
  const clusters = buildClusterEntries(manualRows, top);
  const concentratedRows = clusters.slice(0, 10).reduce((sum, cluster) => sum + cluster.rowCount, 0);

  return {
    rowCount: manualRows.length,
    uniqueClusters: new Set(manualRows.map((row) => row.analysis.clusterKey)).size,
    topTenClusterShare:
      manualRows.length > 0 ? Number(((concentratedRows / manualRows.length) * 100).toFixed(2)) : 0,
    topClusters: clusters,
  };
}

function buildBucketBreakdowns(rows: EnrichedBacklogRow[], top: number) {
  const byBucket: Record<string, number> = {};
  const byBucketCountry: Record<string, Record<string, number>> = {};
  const byBucketSource: Record<string, Record<string, number>> = {};
  const byBucketQuery = new Map<string, EnrichedBacklogRow[]>();

  for (const row of rows) {
    const bucket = row.analysis.bucket;
    increment(byBucket, bucket);
    byBucketCountry[bucket] ||= {};
    byBucketSource[bucket] ||= {};
    increment(byBucketCountry[bucket], getCountryLabel(row));
    increment(byBucketSource[bucket], getSourceLabel(row));
    const bucketRows = byBucketQuery.get(bucket) || [];
    bucketRows.push(row);
    byBucketQuery.set(bucket, bucketRows);
  }

  return {
    byBucket: toSortedEntries(byBucket, top),
    byBucketCountry: Object.fromEntries(
      Object.entries(byBucketCountry).map(([bucket, counts]) => [bucket, toSortedEntries(counts, top)])
    ),
    byBucketSource: Object.fromEntries(
      Object.entries(byBucketSource).map(([bucket, counts]) => [bucket, toSortedEntries(counts, top)])
    ),
    byBucketQuery: Object.fromEntries(
      Array.from(byBucketQuery.entries()).map(([bucket, bucketRows]) => [
        bucket,
        buildQueryFrequency(bucketRows, top),
      ])
    ),
  };
}

function buildInterventionBreakdowns(rows: EnrichedBacklogRow[], top: number) {
  const byIntervention: Record<string, number> = {};
  const byInterventionBucket: Record<string, Record<string, number>> = {};
  const byUnfixableReason: Record<string, number> = {};

  for (const row of rows) {
    const intervention = row.analysis.intervention;
    increment(byIntervention, intervention);
    byInterventionBucket[intervention] ||= {};
    increment(byInterventionBucket[intervention], row.analysis.bucket);
    if (row.analysis.unfixableReason) increment(byUnfixableReason, row.analysis.unfixableReason);
  }

  return {
    byIntervention: toSortedEntries(byIntervention, top),
    byUnfixableReason: toSortedEntries(byUnfixableReason, top),
    byInterventionBucket: Object.fromEntries(
      Object.entries(byInterventionBucket).map(([intervention, counts]) => [
        intervention,
        toSortedEntries(counts, top),
      ])
    ),
  };
}

function getNextMove(report: ReturnType<typeof buildReport>) {
  const topCluster = report.actionableLiftCandidates[0];
  const topCleanup = report.sourceCleanupPatternCandidates[0];
  const topGazetteer = report.gazetteerSeedRecommendations[0];

  if (topCluster?.intervention === "source_cleanup_rule" || (topCleanup?.rowCount || 0) >= 20) {
    return "cleanup_first";
  }
  if (topGazetteer && topGazetteer.rowCount >= 5) return "gazetteer_first";
  if (topCluster?.intervention === "search_coverage_batch") return "continue_search_coverage";
  return "manual_enrichment_probe";
}

function buildReport(rows: EnrichedBacklogRow[], top: number, generatedAt: string) {
  const bucketBreakdowns = buildBucketBreakdowns(rows, top);
  const interventionBreakdowns = buildInterventionBreakdowns(rows, top);
  const actionableLiftCandidates = buildClusterEntries(rows, top, {
    excludeInterventions: ["unfixable"],
  });
  const gazetteerSeedRecommendations = buildGazetteerSeeds(rows, top);
  const sourceCleanupPatternCandidates = buildCleanupCandidates(rows, top);
  const manualEnrichmentDeduplication = buildManualEnrichmentDedup(rows, top);

  return {
    generatedAt,
    metadata: getRunMetadata(generatedAt),
    parameters: {
      top,
      publicMapPrecisions: [...PUBLIC_MAP_PRECISIONS],
      sourceCleanupPatterns: SOURCE_CLEANUP_PATTERNS.map((pattern) => ({
        id: pattern.id,
        label: pattern.label,
        recommendation: pattern.recommendation,
      })),
    },
    totals: {
      activeVisibleRows: rows.length,
      countryHintMismatches: rows.filter((row) => row.countryHintMismatch).length,
    },
    ...bucketBreakdowns,
    ...interventionBreakdowns,
    actionableLiftCandidates,
    gazetteerSeedRecommendations,
    sourceCleanupPatternCandidates,
    manualEnrichmentDeduplication,
    notes: {
      manualEnrichmentDeduplication:
        "This section is limited to review/failed rows triaged as manual_enrichment. The byIntervention manual_enrichment total also includes held-back broad-coordinate rows and other rows that need enrichment.",
    },
    recommendedNextMove: "pending" as string,
  };
}

function renderTable(headers: string[], rows: string[][]) {
  const divider = headers.map(() => "---");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function escapeCell(value: string | number | null | undefined) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function renderMarkdown(report: ReturnType<typeof buildReport>) {
  const lines = [
    "# Location Backlog Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Takeaway",
    "",
    `Recommended next move: \`${report.recommendedNextMove}\`. Public map stays disabled; this report is for choosing the next data intervention, not launch approval.`,
    "",
    "## Totals",
    "",
    renderTable(
      ["Metric", "Value"],
      [
        ["Active visible rows", report.totals.activeVisibleRows.toLocaleString()],
        ["Country hint mismatches", report.totals.countryHintMismatches.toLocaleString()],
      ]
    ),
    "",
    "## Buckets",
    "",
    renderTable(
      ["Bucket", "Rows"],
      report.byBucket.map((entry) => [escapeCell(entry.label), entry.count.toLocaleString()])
    ),
    "",
    "## Actionable Lift Candidates",
    "",
    renderTable(
      ["Rank", "Cluster", "Rows", "Est. Actionable", "Intervention", "Top Countries", "Rationale"],
      report.actionableLiftCandidates.slice(0, 30).map((cluster, index) => [
        String(index + 1),
        escapeCell(cluster.label),
        cluster.rowCount.toLocaleString(),
        cluster.estimatedActionableLift.toLocaleString(),
        cluster.intervention,
        escapeCell(cluster.countries.map((entry) => `${entry.label} ${entry.count}`).join(", ")),
        escapeCell(cluster.rationale),
      ])
    ),
    "",
    "## Gazetteer Seed Recommendations",
    "",
    renderTable(
      ["Name", "Country", "Rows", "Intervention", "Samples"],
      report.gazetteerSeedRecommendations.map((seed) => [
        escapeCell(seed.name),
        escapeCell(seed.country),
        seed.rowCount.toLocaleString(),
        seed.intervention,
        escapeCell(seed.sampleSlugs.join(", ")),
      ])
    ),
    "",
    "## Source Cleanup Pattern Candidates",
    "",
    renderTable(
      ["Pattern", "Rows", "Recommendation", "Samples"],
      report.sourceCleanupPatternCandidates.map((candidate) => [
        escapeCell(candidate.label),
        candidate.rowCount.toLocaleString(),
        escapeCell(candidate.recommendation),
        escapeCell(candidate.sampleLocations.join("; ")),
      ])
    ),
    "",
    "## Manual Enrichment Deduplication",
    "",
    report.notes.manualEnrichmentDeduplication,
    "",
    `Manual enrichment rows: ${report.manualEnrichmentDeduplication.rowCount.toLocaleString()}`,
    "",
    `Unique clusters: ${report.manualEnrichmentDeduplication.uniqueClusters.toLocaleString()}`,
    "",
    `Top ten cluster share: ${report.manualEnrichmentDeduplication.topTenClusterShare}%`,
    "",
    renderTable(
      ["Cluster", "Rows", "Intervention", "Samples"],
      report.manualEnrichmentDeduplication.topClusters.slice(0, 15).map((cluster) => [
        escapeCell(cluster.label),
        cluster.rowCount.toLocaleString(),
        cluster.intervention,
        escapeCell(cluster.sampleSlugs.join(", ")),
      ])
    ),
    "",
    "## Unfixable Reasons",
    "",
    renderTable(
      ["Reason", "Rows"],
      report.byUnfixableReason.map((entry) => [escapeCell(entry.label), entry.count.toLocaleString()])
    ),
    "",
    "## Top Bucket Queries",
    "",
  ];

  for (const [bucket, entries] of Object.entries(report.byBucketQuery)) {
    lines.push(`### ${bucket}`, "");
    lines.push(
      renderTable(
        ["Query/Text", "Rows", "Samples"],
        entries.slice(0, 15).map((entry) => [
          escapeCell(entry.label),
          entry.count.toLocaleString(),
          escapeCell(entry.sampleSlugs.join(", ")),
        ])
      ),
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

async function fetchRows() {
  return query<BacklogRow>(
    `SELECT b.id,
            b.slug,
            b.source_site,
            b.source_name,
            b.location_text,
            b.location_country,
            b.location_region,
            COALESCE(b.location_market_slugs, '{}') AS location_market_slugs,
            b.location_confidence,
            b.location_lat,
            b.location_lng,
            b.location_geocode_status,
            b.location_geocode_query,
            b.location_geocode_place_name,
            b.location_geocode_precision,
            b.location_geocode_score,
            b.location_geocode_error
     FROM boats b
     WHERE ${ACTIVE_VISIBLE_SQL}
     ORDER BY b.slug`
  );
}

async function main() {
  const top = parseTop();
  const stamp = getStamp();
  const outputDir = getOutputDir();
  const generatedAt = new Date().toISOString();
  const rows = (await fetchRows()).map(enrichRow);
  const report = buildReport(rows, top, generatedAt);
  report.recommendedNextMove = getNextMove(report);

  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderMarkdown(report);

  if (hasFlag("--write")) {
    fs.mkdirSync(outputDir, { recursive: true });
    const jsonPath = path.join(outputDir, `${stamp}.json`);
    const markdownPath = path.join(outputDir, `${stamp}.md`);
    fs.writeFileSync(jsonPath, json, "utf8");
    fs.writeFileSync(markdownPath, markdown, "utf8");
    console.log(`Wrote ${jsonPath}`);
    console.log(`Wrote ${markdownPath}`);
  } else if (hasFlag("--md") || hasFlag("--markdown")) {
    console.log(markdown);
  } else {
    console.log(json);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
