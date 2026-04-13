import { pool, query } from "../src/lib/db/index";
import { normalizeImportedMakeModel } from "../src/lib/import-quality";

type ImportCandidate = {
  id: string;
  slug: string | null;
  status: string;
  year: number;
  make: string;
  model: string;
  source_site: string | null;
  source_name: string | null;
  source_url: string | null;
  location_text: string | null;
  asking_price: number;
  asking_price_usd: number | null;
  view_count: number;
  updated_at: string;
  image_count: number;
  summary_length: number;
  documentation_status: Record<string, unknown> | null;
};

const SOURCE_QUALITY_BONUS: Record<string, number> = {
  catamarans_com: 80,
  theyachtmarket: 55,
  denison: 45,
  moorings: 40,
  dreamyacht: 35,
  multihullworld: 35,
  multihullcompany: 30,
  catamaransite: 25,
  sailboatlistings: 10,
};

function parseIntArg(name: string, fallback: number) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const raw = Number.parseInt(process.argv[index + 1] || "", 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function buildNormalizedKey(row: ImportCandidate) {
  const normalized = normalizeImportedMakeModel({
    year: row.year,
    make: row.make,
    model: row.model,
    slug: row.slug,
    sourceSite: row.source_site,
  });
  return {
    make: normalized.make,
    model: normalized.model,
    key: [
      normalized.make.toLowerCase(),
      normalized.model.toLowerCase(),
      String(row.year),
      String(row.location_text || ""),
    ].join("|"),
  };
}

function scoreCandidate(row: ImportCandidate, normalizedModel: string) {
  const qualityScore = Number(row.documentation_status?.import_quality_score || 0);
  const visibleBonus = normalizedModel && row.image_count > 0 && Number(row.asking_price_usd || row.asking_price) >= 3000 ? 120 : 0;
  const sourceBonus = SOURCE_QUALITY_BONUS[row.source_site || ""] || 0;
  const statusBonus = row.status === "active" ? 250 : row.status === "pending_review" ? 60 : 0;
  const imageScore = Math.min(row.image_count, 20) * 20;
  const summaryScore = Math.min(row.summary_length, 220);
  const priceScore = Number(row.asking_price_usd || row.asking_price) >= 3000 ? 25 : -40;
  const viewScore = Math.min(row.view_count || 0, 50) * 2;
  const freshnessScore = Math.max(
    0,
    30 - Math.floor((Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24))
  );

  return qualityScore + visibleBonus + sourceBonus + statusBonus + imageScore + summaryScore + priceScore + viewScore + freshnessScore;
}

async function fetchImportCandidates(limit: number) {
  return query<ImportCandidate>(
    `SELECT b.id, b.slug, b.status, b.year, b.make, b.model, b.source_site, b.source_name, b.source_url,
            b.location_text, b.asking_price, b.asking_price_usd, b.view_count, b.updated_at,
            COALESCE((
              SELECT COUNT(*)
              FROM boat_media bm
              WHERE bm.boat_id = b.id
                AND bm.type = 'image'
            ), 0)::int AS image_count,
            length(COALESCE(d.ai_summary, ''))::int AS summary_length,
            COALESCE(d.documentation_status, '{}') AS documentation_status
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.listing_source = 'imported'
       AND b.status = 'active'
       AND b.source_url IS NOT NULL
     ORDER BY b.updated_at DESC, b.id
     LIMIT $1`,
    [limit]
  );
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const limit = parseIntArg("--limit", 20000);
  const rows = await fetchImportCandidates(limit);

  const groups = new Map<string, Array<ImportCandidate & { normalizedMake: string; normalizedModel: string; rankScore: number }>>();

  for (const row of rows) {
    const normalized = buildNormalizedKey(row);
    if (!normalized.make || !normalized.model) {
      continue;
    }

    const enriched = {
      ...row,
      normalizedMake: normalized.make,
      normalizedModel: normalized.model,
      rankScore: scoreCandidate(row, normalized.model),
    };
    const existing = groups.get(normalized.key);
    if (existing) existing.push(enriched);
    else groups.set(normalized.key, [enriched]);
  }

  let duplicateGroups = 0;
  let expired = 0;
  let activeWinnerGroups = 0;

  for (const entries of groups.values()) {
    if (entries.length < 2) continue;
    duplicateGroups++;
    entries.sort((a, b) => b.rankScore - a.rankScore || b.image_count - a.image_count || b.summary_length - a.summary_length || b.view_count - a.view_count);
    const winner = entries[0];
    const losers = entries.slice(1);
    if (winner.status === "active") activeWinnerGroups++;

    if (!dryRun) {
      const loserIds = losers.map((row) => row.id);
      await query(
        `UPDATE boats
         SET status = CASE WHEN status = 'active' THEN 'expired' ELSE status END,
             updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [loserIds]
      );

      for (const loser of losers) {
        await query(
          `UPDATE boat_dna
           SET documentation_status = COALESCE(documentation_status, '{}'::jsonb) || $2::jsonb
           WHERE boat_id = $1`,
          [
            loser.id,
            JSON.stringify({
              duplicate_resolved: true,
              duplicate_of: winner.id,
              duplicate_key: `${winner.normalizedMake}|${winner.normalizedModel}|${winner.year}|${winner.location_text || ""}`,
              duplicate_resolved_at: new Date().toISOString(),
              duplicate_resolution: "expired_weaker_import",
              duplicate_status_before: loser.status,
              duplicate_scope: "import_index_exact_key",
            }),
          ]
        );
      }
    }

    expired += losers.length;
    if (duplicateGroups <= 5) {
      console.log(
        `[dedupe] winner=${winner.id} ${winner.year} ${winner.normalizedMake} ${winner.normalizedModel} | expired=${losers.length}`
      );
    }
  }

  console.log(
    JSON.stringify(
        {
          scanned: rows.length,
          duplicateGroups,
          expired,
          activeWinnerGroups,
          dryRun,
        },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error("Resolve import duplicates failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
