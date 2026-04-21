import { pool, query } from "../src/lib/db/index";
import type { GeocodePrecision } from "../src/lib/locations/geocoding";
import { inferLocationMarketSignals } from "../src/lib/locations/top-markets";

type BoatLocationRow = {
  id: string;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_approximate: boolean | null;
  location_geocode_precision: GeocodePrecision | null;
};

function resolveCoordinatesApproximate(row: BoatLocationRow) {
  if (row.location_geocode_precision) {
    return !["exact", "street", "marina"].includes(row.location_geocode_precision);
  }

  return row.location_approximate === true;
}

async function main() {
  const rows = await query<BoatLocationRow>(
    `SELECT id,
            location_text,
            location_lat,
            location_lng,
            location_approximate,
            location_geocode_precision
     FROM boats
     ORDER BY updated_at DESC, id`
  );
  let updated = 0;

  for (const row of rows) {
    const signals = inferLocationMarketSignals({
      locationText: row.location_text,
      latitude: row.location_lat,
      longitude: row.location_lng,
      coordinatesApproximate: resolveCoordinatesApproximate(row),
    });
    const result = await query<{ id: string }>(
      `UPDATE boats
       SET location_country = $2,
           location_region = $3,
           location_market_slugs = $4::text[],
           location_confidence = $5,
           location_approximate = $6
       WHERE id = $1
         AND (
           location_country IS DISTINCT FROM $2
           OR location_region IS DISTINCT FROM $3
           OR location_market_slugs IS DISTINCT FROM $4::text[]
           OR location_confidence IS DISTINCT FROM $5
           OR location_approximate IS DISTINCT FROM $6
         )
       RETURNING id`,
      [
        row.id,
        signals.country,
        signals.region,
        signals.marketSlugs,
        signals.confidence,
        signals.approximate,
      ]
    );

    updated += result.length;
  }

  console.log(`Location market backfill complete: ${updated}/${rows.length} boats updated`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
