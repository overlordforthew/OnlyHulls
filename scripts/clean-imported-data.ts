import { pool, query } from "../src/lib/db/index";
import { boatToEmbeddingText, embeddingsEnabled, generateEmbedding } from "../src/lib/ai/embeddings";
import { generateText } from "../src/lib/ai/provider";
import {
  buildImportDocumentationStatus,
  buildImportedCharacterTags,
  buildImportedSummary,
  buildImportQualityFlags,
  buildVisibleImportQualitySql,
  calculateImportQualityScore,
  normalizeImportedMakeModel,
  normalizeImportedSummary,
} from "../src/lib/import-quality";
import { ensureBoatSearchIndex, getActiveBoatSearchDocuments } from "../src/lib/search/boat-index";

type CleanupRow = {
  id: string;
  slug: string | null;
  year: number;
  make: string;
  model: string;
  asking_price: number;
  currency: string;
  asking_price_usd: number | null;
  location_text: string | null;
  source_name: string | null;
  source_url: string | null;
  view_count: number;
  specs: Record<string, unknown>;
  character_tags: string[];
  ai_summary: string | null;
  documentation_status: Record<string, unknown> | null;
  image_count: number;
};

const DEFAULT_LIMIT = Number.MAX_SAFE_INTEGER;
const DEFAULT_LLM_LIMIT = 250;
const SUMMARY_SYSTEM_PROMPT = [
  "You clean up boat marketplace listings.",
  "Rewrite the listing summary in 1-2 factual sentences under 70 words.",
  "Use only the facts provided.",
  "Do not invent features, condition, cruising plans, or equipment.",
  "Avoid hype, exclamation marks, and vague adjectives.",
  "Return plain text only.",
].join(" ");

function parseArgFlag(name: string) {
  return process.argv.includes(name);
}

function parseArgValue(name: string, fallback: number) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const raw = process.argv[index + 1];
  const value = Number.parseInt(raw || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function configureCleanupModel() {
  if ((process.env.IMPORT_CLEANUP_PROVIDER || "").trim()) {
    process.env.AI_PROVIDER = process.env.IMPORT_CLEANUP_PROVIDER;
  } else if ((process.env.OLLAMA_URL || "").trim()) {
    process.env.AI_PROVIDER = "ollama";
  } else if ((process.env.OPENROUTER_KEY || "").trim()) {
    process.env.AI_PROVIDER = "openrouter";
  } else if ((process.env.OPENAI_API_KEY || "").trim()) {
    process.env.AI_PROVIDER = "openai";
  }

  if (process.env.AI_PROVIDER === "ollama") {
    process.env.OLLAMA_CHAT_MODEL = process.env.IMPORT_CLEANUP_MODEL || process.env.OLLAMA_CHAT_MODEL || "qwen2.5:7b";
  }
  if (process.env.AI_PROVIDER === "openrouter") {
    process.env.OPENROUTER_CHAT_MODEL =
      process.env.IMPORT_CLEANUP_MODEL || process.env.OPENROUTER_CHAT_MODEL || "openrouter/free";
  }
  if (process.env.AI_PROVIDER === "openai") {
    process.env.OPENAI_CHAT_MODEL =
      process.env.IMPORT_CLEANUP_MODEL || process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
  }

  return {
    provider: process.env.AI_PROVIDER || "none",
    model:
      process.env.IMPORT_CLEANUP_MODEL ||
      process.env.OLLAMA_CHAT_MODEL ||
      process.env.OPENROUTER_CHAT_MODEL ||
      process.env.OPENAI_CHAT_MODEL ||
      "none",
  };
}

function normalizeLlmSummary(value: string) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldUseLlm(row: CleanupRow, llmRemaining: number) {
  if (llmRemaining < 1) return false;
  if (!row.source_url) return false;
  if (row.image_count < 1) return false;
  if (!row.model.trim()) return false;
  const summarySource = String(row.documentation_status?.summary_source || "");
  if (summarySource === "llm") return false;
  return !row.ai_summary || row.ai_summary.trim().length < 100;
}

async function maybeGenerateLlmSummary(row: CleanupRow, fallbackSummary: string) {
  const facts = {
    title: `${row.year} ${row.make} ${row.model}`.trim(),
    price: `${row.currency} ${Math.round(Number(row.asking_price)).toLocaleString("en-US")}`,
    location: row.location_text || "",
    specs: {
      loa: row.specs?.loa ?? null,
      beam: row.specs?.beam ?? null,
      draft: row.specs?.draft ?? null,
      rig_type: row.specs?.rig_type ?? null,
      hull_material: row.specs?.hull_material ?? null,
      cabins: row.specs?.cabins ?? null,
      berths: row.specs?.berths ?? null,
      heads: row.specs?.heads ?? null,
      keel_type: row.specs?.keel_type ?? null,
    },
    source_name: row.source_name || "",
    fallback_summary: fallbackSummary,
  };

  const llm = await generateText(
    SUMMARY_SYSTEM_PROMPT,
    JSON.stringify(facts, null, 2)
  );
  const output = normalizeLlmSummary(llm.output);
  if (output.length < 40 || output.length > 320) {
    return null;
  }

  return {
    summary: output,
    provider: llm.provider,
    model: llm.model,
  };
}

async function fetchCandidates(limit: number) {
  return query<CleanupRow>(
    `SELECT b.id, b.slug, b.year, b.make, b.model, b.asking_price, b.currency, b.asking_price_usd,
            b.location_text, b.source_name, b.source_url, b.view_count,
            COALESCE(d.specs, '{}') AS specs,
            COALESCE(d.character_tags, '{}') AS character_tags,
            d.ai_summary,
            COALESCE(d.documentation_status, '{}') AS documentation_status,
            COALESCE((
              SELECT COUNT(*)
              FROM boat_media bm
              WHERE bm.boat_id = b.id
                AND bm.type = 'image'
            ), 0)::int AS image_count
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
       AND b.source_url IS NOT NULL
     ORDER BY b.view_count DESC, b.created_at DESC, b.id
     LIMIT $1`,
    [limit]
  );
}

async function reindexVisibleBoats() {
  const index = await ensureBoatSearchIndex();
  const docs = await getActiveBoatSearchDocuments();
  await index.deleteAllDocuments();

  const chunkSize = 500;
  for (let indexOffset = 0; indexOffset < docs.length; indexOffset += chunkSize) {
    const batch = docs.slice(indexOffset, indexOffset + chunkSize);
    await index.addDocuments(batch);
  }

  return docs.length;
}

async function main() {
  const dryRun = parseArgFlag("--dry-run");
  const reindex = parseArgFlag("--reindex");
  const skipEmbeddings = parseArgFlag("--skip-embeddings");
  const limit = parseArgValue("--limit", DEFAULT_LIMIT);
  const llmLimit = parseArgValue("--llm-limit", DEFAULT_LLM_LIMIT);
  const modelConfig = configureCleanupModel();
  const shouldRefreshEmbeddings = !skipEmbeddings && !dryRun && embeddingsEnabled();

  const rows = await fetchCandidates(limit);
  if (rows.length === 0) {
    console.log("Imported cleanup: nothing to process.");
    return;
  }

  let processed = 0;
  let llmUsed = 0;
  let visible = 0;
  let hidden = 0;
  let embeddingsUpdated = 0;

  for (const row of rows) {
    const normalized = normalizeImportedMakeModel({
      make: row.make,
      model: row.model,
      slug: row.slug,
    });
    const normalizedTags = buildImportedCharacterTags({
      priceUsd: row.asking_price_usd,
      loa: typeof row.specs?.loa === "number" ? row.specs.loa : null,
      rigType: typeof row.specs?.rig_type === "string" ? row.specs.rig_type : null,
      existingTags: row.character_tags,
    });
    const cleanedSourceSummary = normalizeImportedSummary(row.ai_summary);
    let summary = cleanedSourceSummary;
    let summarySource: "source" | "deterministic" | "llm" = cleanedSourceSummary ? "source" : "deterministic";

    if (!summary) {
      summary = buildImportedSummary({
        year: row.year,
        make: normalized.make,
        model: normalized.model,
        locationText: row.location_text,
        price: Number(row.asking_price),
        currency: row.currency,
        loa: typeof row.specs?.loa === "number" ? row.specs.loa : null,
        rigType: typeof row.specs?.rig_type === "string" ? row.specs.rig_type : null,
        hullMaterial: typeof row.specs?.hull_material === "string" ? row.specs.hull_material : null,
        berths: typeof row.specs?.berths === "number" ? row.specs.berths : null,
        heads: typeof row.specs?.heads === "number" ? row.specs.heads : null,
        sourceName: row.source_name,
      });
    }

    if (shouldUseLlm({ ...row, make: normalized.make, model: normalized.model, ai_summary: summary }, llmLimit - llmUsed)) {
      try {
        const llmResult = await maybeGenerateLlmSummary(
          { ...row, make: normalized.make, model: normalized.model, ai_summary: summary },
          summary
        );
        if (llmResult) {
          summary = llmResult.summary;
          summarySource = "llm";
          llmUsed += 1;
        }
      } catch (err) {
        console.warn(`LLM cleanup skipped for ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const qualityFlags = buildImportQualityFlags({
      model: normalized.model,
      imageCount: row.image_count,
      priceUsd: row.asking_price_usd,
      summary,
    });
    const qualityScore = calculateImportQualityScore(qualityFlags);
    const documentationStatus = buildImportDocumentationStatus({
      flags: qualityFlags,
      score: qualityScore,
      summarySource,
      sourceName: row.source_name,
      imageCount: row.image_count,
      priceUsd: row.asking_price_usd,
    });
    if (summarySource === "llm") {
      documentationStatus.summary_model = modelConfig.model;
      documentationStatus.summary_provider = modelConfig.provider;
    }

    const embeddingText = boatToEmbeddingText({
      make: normalized.make,
      model: normalized.model,
      year: row.year,
      asking_price: row.asking_price,
      currency: row.currency,
      location_text: row.location_text,
      specs: row.specs,
      character_tags: normalizedTags,
      ai_summary: summary,
    });
    const embedding = shouldRefreshEmbeddings ? await generateEmbedding(embeddingText) : [];

    if (!dryRun) {
      await query(
        `UPDATE boats
         SET make = $2,
             model = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, normalized.make, normalized.model]
      );

      await query(
        `INSERT INTO boat_dna (boat_id, specs, character_tags, ai_summary, documentation_status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (boat_id) DO UPDATE SET
           specs = EXCLUDED.specs,
           character_tags = EXCLUDED.character_tags,
           ai_summary = EXCLUDED.ai_summary,
           documentation_status = EXCLUDED.documentation_status`,
        [
          row.id,
          JSON.stringify(row.specs || {}),
          normalizedTags,
          summary,
          JSON.stringify(documentationStatus),
        ]
      );

      if (embedding.length > 0) {
        await query("UPDATE boats SET dna_embedding = $2 WHERE id = $1", [
          row.id,
          `[${embedding.join(",")}]`,
        ]);
        embeddingsUpdated += 1;
      }
    }

    if (qualityFlags.length === 0) visible += 1;
    else hidden += 1;

    processed += 1;
    if (processed <= 5 || processed % 200 === 0) {
      console.log(
        `[cleanup] ${processed}/${rows.length} ${row.year} ${normalized.make} ${normalized.model} | ${summarySource} | flags=${qualityFlags.join(",") || "none"}`
      );
    }
  }

  let reindexed = 0;
  if (!dryRun && reindex) {
    reindexed = await reindexVisibleBoats();
  }

  const visibleCount = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM boats b
     WHERE b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}`
  );

  console.log(
    JSON.stringify(
      {
        processed,
        llmUsed,
        visibleInBatch: visible,
        hiddenInBatch: hidden,
        embeddingsUpdated,
        reindexed,
        visibleActiveCount: Number.parseInt(visibleCount[0]?.count || "0", 10),
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error("Imported cleanup failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
