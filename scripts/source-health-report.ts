import { pool, query } from "../src/lib/db";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import { getSourceDecisionByName } from "../src/lib/source-policy";

type SourceHealthRow = {
  source: string;
  active_count: string;
  visible_count: string;
  contact_clicks_30d: string;
  missing_model_count: string;
  missing_location_count: string;
  missing_image_count: string;
  thin_summary_count: string;
  low_price_count: string;
};

function parseArgValue(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function pct(visible: number, total: number) {
  if (total <= 0) return "0.0%";
  return `${((visible / total) * 100).toFixed(1)}%`;
}

async function main() {
  const format = parseArgValue("--format", "table");
  const limitRaw = Number.parseInt(parseArgValue("--limit", "12"), 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 12;

  const rows = await query<SourceHealthRow>(
    `SELECT
       COALESCE(b.source_name, 'Platform') AS source,
       COUNT(*)::text AS active_count,
       COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")})::text AS visible_count,
       COALESCE(SUM(COALESCE(clicks.click_count_30d, 0)), 0)::text AS contact_clicks_30d,
       COUNT(*) FILTER (
         WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_model'
       )::text AS missing_model_count,
       COUNT(*) FILTER (
         WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_location'
       )::text AS missing_location_count,
       COUNT(*) FILTER (
         WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_image'
       )::text AS missing_image_count,
       COUNT(*) FILTER (
         WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'thin_summary'
       )::text AS thin_summary_count,
       COUNT(*) FILTER (
         WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'low_price'
       )::text AS low_price_count
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     LEFT JOIN (
       SELECT boat_id, COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS click_count_30d
       FROM contact_clicks
       GROUP BY boat_id
     ) clicks ON clicks.boat_id = b.id
     WHERE b.listing_source = 'imported'
       AND b.status = 'active'
     GROUP BY COALESCE(b.source_name, 'Platform')
     ORDER BY COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")}) DESC,
              COUNT(*) DESC
     LIMIT $1`,
    [limit]
  );

  const report = rows.map((row) => {
    const active = Number.parseInt(row.active_count, 10);
    const visible = Number.parseInt(row.visible_count, 10);
    const decision = getSourceDecisionByName(row.source);

    return {
      source: row.source,
      active,
      visible,
      visibleRate: pct(visible, active),
      contactClicks30d: Number.parseInt(row.contact_clicks_30d, 10),
      decisionStatus: decision?.status ?? "undecided",
      decisionReason: decision?.reason ?? null,
      missingModel: Number.parseInt(row.missing_model_count, 10),
      missingLocation: Number.parseInt(row.missing_location_count, 10),
      missingImage: Number.parseInt(row.missing_image_count, 10),
      thinSummary: Number.parseInt(row.thin_summary_count, 10),
      lowPrice: Number.parseInt(row.low_price_count, 10),
    };
  });

  if (hasFlag("--json") || format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("Source health (active imported inventory)");
  console.log("source | active | visible | visible rate | clicks 30d | decision | miss model | miss location | miss image | thin summary | low price");
  for (const row of report) {
    console.log(
      `${row.source} | ${row.active} | ${row.visible} | ${row.visibleRate} | ${row.contactClicks30d} | ${row.decisionStatus} | ${row.missingModel} | ${row.missingLocation} | ${row.missingImage} | ${row.thinSummary} | ${row.lowPrice}`
    );
  }
}

main()
  .catch((err) => {
    console.error("Source health report failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
