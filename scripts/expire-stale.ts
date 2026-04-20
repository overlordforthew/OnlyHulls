/**
 * Expire imported boat listings not seen by complete source crawls.
 *
 * Daily scrapes are intentionally partial, so they must not be treated as proof
 * that unseen listings are gone. A source becomes expiration-eligible only after
 * import-scraped.ts records a recent --full crawl in import_source_crawl_state.
 *
 * Usage:
 *   npx tsx scripts/expire-stale.ts [--dry-run] [--source sailboatlistings]
 *   npx tsx scripts/expire-stale.ts --force-mass-expire --source theyachtmarket
 */

import { pool, query } from "../src/lib/db/index";

const DEFAULT_STALE_DAYS = 14;
const MASS_EXPIRE_THRESHOLD = 0.2;

type SourceCandidate = {
  source_site: string;
  source_name: string | null;
  active_count: string;
  stale_count: string;
  last_full_crawl_at: string | null;
};

type ExpiredRow = {
  id: string;
  make: string;
  model: string;
  source_name: string | null;
  source_site: string | null;
};

type ParsedArgs = {
  dryRun: boolean;
  forceMassExpire: boolean;
  sourceSite: string | null;
  staleDays: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const parsed: ParsedArgs = {
    dryRun: args.includes("--dry-run"),
    forceMassExpire: args.includes("--force-mass-expire"),
    sourceSite: null,
    staleDays: DEFAULT_STALE_DAYS,
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--source") {
      parsed.sourceSite = args[index + 1] || null;
      index++;
    } else if (arg === "--stale-days") {
      const value = Number(args[index + 1]);
      if (Number.isFinite(value) && value > 0) {
        parsed.staleDays = Math.floor(value);
      }
      index++;
    }
  }

  return parsed;
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

async function getSourceCandidates(options: ParsedArgs) {
  const params: unknown[] = [options.staleDays];
  const sourceFilter = options.sourceSite ? `AND b.source_site = $2` : "";
  if (options.sourceSite) params.push(options.sourceSite);

  return query<SourceCandidate>(
    `WITH active_sources AS (
       SELECT
         COALESCE(b.source_site, '') AS source_site,
         MAX(b.source_name) AS source_name,
         COUNT(*)::int AS active_count
       FROM boats b
       WHERE b.listing_source = 'imported'
         AND b.status = 'active'
         ${sourceFilter}
       GROUP BY COALESCE(b.source_site, '')
     ),
     stale_sources AS (
       SELECT
         COALESCE(b.source_site, '') AS source_site,
         COUNT(*)::int AS stale_count
       FROM boats b
       WHERE b.listing_source = 'imported'
         AND b.status = 'active'
         AND b.last_seen_at < NOW() - ($1::int * INTERVAL '1 day')
         ${sourceFilter}
       GROUP BY COALESCE(b.source_site, '')
     )
     SELECT
       active_sources.source_site,
       active_sources.source_name,
       active_sources.active_count::text,
       COALESCE(stale_sources.stale_count, 0)::text AS stale_count,
       state.last_full_crawl_at::text
     FROM active_sources
     LEFT JOIN stale_sources ON stale_sources.source_site = active_sources.source_site
     LEFT JOIN import_source_crawl_state state
       ON state.source_site = active_sources.source_site
     ORDER BY COALESCE(stale_sources.stale_count, 0) DESC, active_sources.source_site`,
    params
  );
}

async function expireStale() {
  const options = parseArgs(process.argv.slice(2));
  const candidates = await getSourceCandidates(options);
  const eligibleSources: string[] = [];
  const skipped: string[] = [];
  const unsafe: string[] = [];
  let wouldExpire = 0;

  for (const source of candidates) {
    const staleCount = Number(source.stale_count);
    const activeCount = Number(source.active_count);
    if (staleCount <= 0) continue;

    const label = source.source_site || source.source_name || "unknown";
    const crawlIsFresh =
      source.last_full_crawl_at !== null &&
      Date.parse(source.last_full_crawl_at) >= Date.now() - options.staleDays * 24 * 60 * 60 * 1000;

    if (!crawlIsFresh) {
      skipped.push(`${label}: ${staleCount} stale candidates skipped; no recent full crawl`);
      continue;
    }

    const ratio = activeCount > 0 ? staleCount / activeCount : 1;
    if (ratio > MASS_EXPIRE_THRESHOLD && !options.forceMassExpire) {
      unsafe.push(
        `${label}: ${staleCount}/${activeCount} stale (${formatPercent(ratio)}), above ${formatPercent(MASS_EXPIRE_THRESHOLD)} threshold`
      );
      continue;
    }

    eligibleSources.push(source.source_site);
    wouldExpire += staleCount;
  }

  if (skipped.length > 0) {
    console.log("Skipped stale candidates without a recent full crawl:");
    for (const line of skipped) console.log(`  [skip] ${line}`);
  }

  if (unsafe.length > 0) {
    console.error("Refusing mass expiration without --force-mass-expire:");
    for (const line of unsafe) console.error(`  [unsafe] ${line}`);
    process.exitCode = 1;
  }

  if (eligibleSources.length === 0 || process.exitCode === 1) {
    console.log(
      options.dryRun
        ? `Dry run: would expire 0 stale listings.`
        : "No stale listings eligible to expire."
    );
    await printStats();
    await pool.end();
    return;
  }

  if (options.dryRun) {
    console.log(`Dry run: would expire ${wouldExpire} stale listings from ${eligibleSources.join(", ")}.`);
    await printStats();
    await pool.end();
    return;
  }

  const result = await query<ExpiredRow>(
    `UPDATE boats
     SET status = 'expired', updated_at = NOW()
     WHERE listing_source = 'imported'
       AND status = 'active'
       AND last_seen_at < NOW() - ($1::int * INTERVAL '1 day')
       AND COALESCE(source_site, '') = ANY($2::text[])
     RETURNING id, make, model, source_name, source_site`,
    [options.staleDays, eligibleSources]
  );

  if (result.length > 0) {
    console.log(`Expired ${result.length} stale listings after recent full crawl:`);
    for (const b of result.slice(0, 50)) {
      console.log(`  [-] ${b.make} ${b.model} (${b.source_name || b.source_site || "unknown"})`);
    }
    if (result.length > 50) {
      console.log(`  ... ${result.length - 50} more`);
    }
  } else {
    console.log("No stale listings to expire.");
  }

  await printStats();
  await pool.end();
}

async function printStats() {
  const stats = await query<{ status: string; count: string }>(
    `SELECT status, count(*)
     FROM boats
     WHERE listing_source = 'imported'
     GROUP BY status
     ORDER BY count DESC`
  );
  console.log("\nImported listing stats:");
  for (const s of stats) {
    console.log(`  ${s.status}: ${s.count}`);
  }
}

expireStale().catch(async (err) => {
  console.error("Expire failed:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
