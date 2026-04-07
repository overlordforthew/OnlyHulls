import { query, queryOne, pool } from "../src/lib/db/index";
import {
  boatToEmbeddingText,
  embeddingsEnabled,
  generateEmbeddings,
  getEmbeddingProvider,
  profileToEmbeddingText,
} from "../src/lib/ai/embeddings";

const BATCH_SIZE = 24;

interface BoatRow {
  id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  location_text: string | null;
  specs: Record<string, unknown>;
  character_tags: string[];
  ai_summary: string | null;
}

interface BuyerRow {
  id: string;
  use_case: string[];
  budget_range: Record<string, unknown>;
  boat_type_prefs: Record<string, unknown>;
  spec_preferences: Record<string, unknown>;
  location_prefs: Record<string, unknown>;
  experience_level: string | null;
  deal_breakers: string[];
  timeline: string | null;
  refit_tolerance: string | null;
}

async function updateBoatBatch(rows: BoatRow[]) {
  const texts = rows.map((row) =>
    boatToEmbeddingText({
      make: row.make,
      model: row.model,
      year: row.year,
      asking_price: row.asking_price,
      currency: row.currency,
      location_text: row.location_text,
      specs: row.specs,
      character_tags: row.character_tags,
      ai_summary: row.ai_summary,
    })
  );

  const embeddings = await generateEmbeddings(texts);
  for (let index = 0; index < rows.length; index++) {
    const embedding = embeddings[index];
    if (!embedding?.length) continue;

    await query("UPDATE boats SET dna_embedding = $1 WHERE id = $2", [
      `[${embedding.join(",")}]`,
      rows[index].id,
    ]);
  }
}

async function updateBuyerBatch(rows: BuyerRow[]) {
  const texts = rows.map((row) =>
    profileToEmbeddingText({
      use_case: row.use_case,
      budget_range: row.budget_range,
      boat_type_prefs: row.boat_type_prefs,
      spec_preferences: row.spec_preferences,
      location_prefs: row.location_prefs,
      experience_level: row.experience_level,
      deal_breakers: row.deal_breakers,
      timeline: row.timeline,
      refit_tolerance: row.refit_tolerance,
    })
  );

  const embeddings = await generateEmbeddings(texts);
  for (let index = 0; index < rows.length; index++) {
    const embedding = embeddings[index];
    if (!embedding?.length) continue;

    await query("UPDATE buyer_profiles SET dna_embedding = $1 WHERE id = $2", [
      `[${embedding.join(",")}]`,
      rows[index].id,
    ]);
  }
}

async function backfillBoatEmbeddings() {
  let updated = 0;

  while (true) {
    const rows = await query<BoatRow>(
      `SELECT b.id, b.make, b.model, b.year, b.asking_price, b.currency, b.location_text,
              COALESCE(d.specs, '{}'::jsonb) as specs,
              COALESCE(d.character_tags, ARRAY[]::text[]) as character_tags,
              d.ai_summary
       FROM boats b
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       WHERE b.status = 'active'
         AND b.dna_embedding IS NULL
       ORDER BY b.created_at ASC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (!rows.length) {
      break;
    }

    await updateBoatBatch(rows);
    updated += rows.length;
    console.log(`Boat embeddings updated: ${updated}`);
  }

  return updated;
}

async function backfillBuyerEmbeddings() {
  let updated = 0;

  while (true) {
    const rows = await query<BuyerRow>(
      `SELECT id, use_case, budget_range, boat_type_prefs, spec_preferences, location_prefs,
              experience_level, deal_breakers, timeline, refit_tolerance
       FROM buyer_profiles
       WHERE dna_embedding IS NULL
       ORDER BY created_at ASC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (!rows.length) {
      break;
    }

    await updateBuyerBatch(rows);
    updated += rows.length;
    console.log(`Buyer embeddings updated: ${updated}`);
  }

  return updated;
}

async function main() {
  if (!embeddingsEnabled()) {
    throw new Error("Embeddings are not configured");
  }

  const provider = getEmbeddingProvider();
  const boatCountBefore = await queryOne<{ count: string }>(
    "SELECT COUNT(*) FROM boats WHERE status = 'active' AND dna_embedding IS NULL"
  );
  const buyerCountBefore = await queryOne<{ count: string }>(
    "SELECT COUNT(*) FROM buyer_profiles WHERE dna_embedding IS NULL"
  );

  console.log(
    JSON.stringify({
      provider,
      boatsMissing: Number(boatCountBefore?.count || "0"),
      buyersMissing: Number(buyerCountBefore?.count || "0"),
    })
  );

  const boatsUpdated = await backfillBoatEmbeddings();
  const buyersUpdated = await backfillBuyerEmbeddings();

  console.log(JSON.stringify({ boatsUpdated, buyersUpdated }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
