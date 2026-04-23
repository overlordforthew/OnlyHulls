import { pool, query } from "../src/lib/db/index";
import { inferLocationMarketSignals } from "../src/lib/locations/top-markets";

// Rescues boats whose location_country is blank by re-running the location
// inference helper over their location_text. Most rows that failed the original
// import wave simply lacked US state / Canadian province entries in
// ADMIN_COUNTRY_HINTS at the time they were imported. Those hints now cover the
// full US/Canada administrative layer, so a rerun picks most of them up for
// free.
//
// Specific single-token texts (e.g. "Washington") are too ambiguous for the
// generic hint pipeline without false-matching "Port Washington, NY" etc., so
// they are handled here with an explicit exact-string map.

const EXACT_TEXT_COUNTRY_FALLBACKS: Record<
  string,
  { country: string; region: string }
> = {
  washington: { country: "United States", region: "Washington" },
  "virgin islands": { country: "United States Virgin Islands", region: "Caribbean" },
  "virgin islands british": { country: "British Virgin Islands", region: "Caribbean" },
  "virgin islands, british": { country: "British Virgin Islands", region: "Caribbean" },
};

type Candidate = {
  id: string;
  location_text: string | null;
};

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const apply = hasFlag("--apply");

  const rows = await query<Candidate>(
    `SELECT id, location_text
       FROM boats
      WHERE (location_country IS NULL OR TRIM(location_country) = '')
        AND location_text IS NOT NULL
        AND TRIM(location_text) != ''`
  );

  let resolved = 0;
  let unresolved = 0;
  const countryTally: Record<string, number> = {};
  const sampleUnresolved: string[] = [];

  const updates: Array<{
    id: string;
    country: string;
    region: string | null;
    marketSlugs: string[];
  }> = [];

  for (const row of rows) {
    const raw = String(row.location_text || "").trim();
    const normalized = raw.toLowerCase();
    const signals = inferLocationMarketSignals({ locationText: raw });
    let country = signals.country;
    let region = signals.region;
    let marketSlugs = signals.marketSlugs;

    if (!country) {
      const fallback = EXACT_TEXT_COUNTRY_FALLBACKS[normalized];
      if (fallback) {
        country = fallback.country;
        region = fallback.region;
        marketSlugs = []; // leave market signals for a later enrichment pass
      }
    }

    if (country) {
      resolved += 1;
      countryTally[country] = (countryTally[country] || 0) + 1;
      updates.push({ id: row.id, country, region, marketSlugs });
    } else {
      unresolved += 1;
      if (sampleUnresolved.length < 20) sampleUnresolved.push(raw);
    }
  }

  if (apply) {
    for (const update of updates) {
      await query(
        `UPDATE boats
            SET location_country = $2,
                location_region = COALESCE(location_region, $3),
                location_market_slugs = CASE
                  WHEN $4::text[] IS NULL OR cardinality($4::text[]) = 0 THEN location_market_slugs
                  ELSE $4::text[]
                END,
                updated_at = NOW()
          WHERE id = $1`,
        [update.id, update.country, update.region, update.marketSlugs]
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        totalMissingCountry: rows.length,
        resolved,
        unresolved,
        countryTally,
        sampleUnresolved,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
