/**
 * Expire imported boat listings not seen by scrapers in 14+ days.
 * Run after the daily scrape to clean up stale/sold boats.
 *
 * Usage: npx tsx scripts/expire-stale.ts
 */

import { pool, query } from "../src/lib/db/index";

const STALE_DAYS = 14;

async function expireStale() {
  const result = await query<{ id: string; make: string; model: string; source_name: string }>(
    `UPDATE boats SET status = 'expired', updated_at = NOW()
     WHERE listing_source = 'imported'
       AND status = 'active'
       AND last_seen_at < NOW() - INTERVAL '${STALE_DAYS} days'
     RETURNING id, make, model, source_name`
  );

  if (result.length > 0) {
    console.log(`Expired ${result.length} stale listings (not seen in ${STALE_DAYS}+ days):`);
    for (const b of result) {
      console.log(`  [-] ${b.make} ${b.model} (${b.source_name})`);
    }
  } else {
    console.log("No stale listings to expire.");
  }

  // Stats
  const stats = await query<{ status: string; count: string }>(
    `SELECT status, count(*) FROM boats WHERE listing_source = 'imported' GROUP BY status ORDER BY count DESC`
  );
  console.log("\nImported listing stats:");
  for (const s of stats) {
    console.log(`  ${s.status}: ${s.count}`);
  }

  await pool.end();
}

expireStale().catch((err) => {
  console.error("Expire failed:", err);
  process.exit(1);
});
