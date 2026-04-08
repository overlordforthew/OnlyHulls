import { createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { pool, query } from "../src/lib/db/index";
import { logLLMResponse } from "../src/lib/ai/logging";
import { buildVisibleImportQualitySql, normalizeImportedSummary } from "../src/lib/import-quality";
import { ensureBoatSearchIndex, getActiveBoatSearchDocuments } from "../src/lib/search/boat-index";

const execFileAsync = promisify(execFile);

type Scope = "imports" | "matches" | "both";

type ImportRow = {
  id: string;
  year: number;
  make: string;
  model: string;
  source_site: string | null;
  source_name: string | null;
  location_text: string | null;
  asking_price: number;
  currency: string;
  view_count: number;
  specs: Record<string, unknown>;
  ai_summary: string | null;
  documentation_status: Record<string, unknown> | null;
};

type MatchRow = {
  match_id: string;
  buyer_id: string;
  boat_id: string;
  score: number;
  year: number;
  make: string;
  model: string;
  asking_price: number;
  currency: string;
  location_text: string | null;
  specs: Record<string, unknown>;
  character_tags: string[];
  ai_summary: string | null;
  use_case: string[];
  budget_range: Record<string, unknown>;
  boat_type_prefs: Record<string, unknown>;
  spec_preferences: Record<string, unknown>;
  location_prefs: Record<string, unknown>;
  refit_tolerance: string | null;
  current_summary: string | null;
};

type MatchCopyPayload = {
  summary: string;
  strengths: string[];
  risks: string[];
  confidence: number;
};

function parseArgValue(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function parseArgInt(name: string, fallback: number) {
  const raw = parseArgValue(name, String(fallback));
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function normalizeTextOutput(value: string) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonObject(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidates = [fenced, trimmed, raw.match(/\{[\s\S]*\}/)?.[0]].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return null;
}

async function callClaudeHaiku(prompt: string, model: string) {
  const startedAt = Date.now();
  const { stdout } = await execFileAsync(
    "claude",
    ["-p", "--model", model, "--output-format", "text", prompt],
    { maxBuffer: 2 * 1024 * 1024 }
  );

  return {
    output: String(stdout || "").trim(),
    latencyMs: Date.now() - startedAt,
  };
}

async function reindexVisibleBoats() {
  const index = await ensureBoatSearchIndex();
  const docs = await getActiveBoatSearchDocuments();
  await index.deleteAllDocuments();

  for (let indexOffset = 0; indexOffset < docs.length; indexOffset += 500) {
    await index.addDocuments(docs.slice(indexOffset, indexOffset + 500));
  }

  return docs.length;
}

async function fetchImportRows(limit: number) {
  return query<ImportRow>(
    `SELECT b.id, b.year, b.make, b.model, b.source_site, b.source_name, b.location_text,
            b.asking_price, b.currency, b.view_count,
            COALESCE(d.specs, '{}') AS specs,
            d.ai_summary,
            COALESCE(d.documentation_status, '{}') AS documentation_status
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
       AND b.source_url IS NOT NULL
       AND ${buildVisibleImportQualitySql("b")}
       AND COALESCE(d.documentation_status->>'summary_source', '') <> 'llm'
     ORDER BY CASE WHEN b.source_site = 'sailboatlistings' THEN 0 ELSE 1 END,
              b.view_count DESC,
              b.updated_at DESC
     LIMIT $1`,
    [limit]
  );
}

async function fetchMatchRows(limit: number) {
  return query<MatchRow>(
    `SELECT m.id AS match_id, m.buyer_id, b.id AS boat_id, m.score,
            b.year, b.make, b.model, b.asking_price, b.currency, b.location_text,
            COALESCE(d.specs, '{}') AS specs,
            COALESCE(d.character_tags, ARRAY[]::text[]) AS character_tags,
            d.ai_summary,
            bp.use_case, bp.budget_range, bp.boat_type_prefs, bp.spec_preferences,
            bp.location_prefs, bp.refit_tolerance,
            me.summary AS current_summary
     FROM matches m
     JOIN boats b ON b.id = m.boat_id
     JOIN buyer_profiles bp ON bp.id = m.buyer_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     LEFT JOIN match_explanations me ON me.match_id = m.id
     WHERE b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}
       AND m.buyer_action != 'passed'
       AND (me.provider IS DISTINCT FROM 'claude-cli' OR me.updated_at < NOW() - INTERVAL '7 days')
     ORDER BY m.score DESC, m.updated_at DESC
     LIMIT $1`,
    [limit]
  );
}

function buildImportPrompt(row: ImportRow) {
  return [
    "Rewrite this boat listing summary for buyers.",
    "Use 1-2 factual sentences, under 70 words.",
    "Use only the supplied facts.",
    "Do not invent equipment, condition, history, or sailing plans.",
    "No hype, no bullets, plain text only.",
    "",
    JSON.stringify(
      {
        title: `${row.year} ${row.make} ${row.model}`.trim(),
        source_site: row.source_site,
        source_name: row.source_name,
        asking_price: `${row.currency} ${Math.round(Number(row.asking_price)).toLocaleString("en-US")}`,
        location_text: row.location_text,
        specs: row.specs,
        current_summary: normalizeImportedSummary(row.ai_summary),
      },
      null,
      2
    ),
  ].join("\n");
}

function buildMatchPrompt(row: MatchRow) {
  return [
    "You are writing concise buyer-facing match copy for a boat marketplace.",
    "Return strict JSON only.",
    'Shape: {"summary":"...","strengths":["..."],"risks":["..."],"confidence":0.1}',
    "Summary: 1-2 sentences, under 80 words, factual and practical.",
    "strengths: 1 to 3 concise items.",
    "risks: 0 to 2 concise items.",
    "Use only the facts supplied.",
    "Do not invent survey results, maintenance history, or equipment.",
    "",
    JSON.stringify(
      {
        match_score: row.score,
        buyer: {
          use_case: row.use_case,
          budget_range: row.budget_range,
          boat_type_prefs: row.boat_type_prefs,
          spec_preferences: row.spec_preferences,
          location_prefs: row.location_prefs,
          refit_tolerance: row.refit_tolerance,
        },
        boat: {
          title: `${row.year} ${row.make} ${row.model}`.trim(),
          asking_price: `${row.currency} ${Math.round(Number(row.asking_price)).toLocaleString("en-US")}`,
          location_text: row.location_text,
          specs: row.specs,
          character_tags: row.character_tags,
          ai_summary: normalizeImportedSummary(row.ai_summary),
        },
        current_summary: row.current_summary || "",
      },
      null,
      2
    ),
  ].join("\n");
}

function normalizeMatchCopy(raw: Record<string, unknown>, fallback: string): MatchCopyPayload {
  const summary = normalizeTextOutput(String(raw.summary || fallback)).slice(0, 400);
  const strengths = Array.isArray(raw.strengths)
    ? raw.strengths.map((item) => normalizeTextOutput(String(item || ""))).filter(Boolean).slice(0, 3)
    : [];
  const risks = Array.isArray(raw.risks)
    ? raw.risks.map((item) => normalizeTextOutput(String(item || ""))).filter(Boolean).slice(0, 2)
    : [];
  const confidenceRaw = Number(raw.confidence || 0.6);
  const confidence = Math.max(0.1, Math.min(0.95, Number.isFinite(confidenceRaw) ? confidenceRaw : 0.6));

  return {
    summary,
    strengths,
    risks,
    confidence,
  };
}

async function processImports(limit: number, model: string, dryRun: boolean) {
  const rows = await fetchImportRows(limit);
  let updated = 0;

  for (const row of rows) {
    const prompt = buildImportPrompt(row);
    const promptHash = createHash("sha256").update(prompt).digest("hex").slice(0, 32);
    const result = await callClaudeHaiku(prompt, model);
    const summary = normalizeTextOutput(result.output);
    if (!summary) {
      continue;
    }

    await logLLMResponse({
      scopeType: "boat",
      scopeId: row.id,
      taskType: "listing_copy_cleanup",
      provider: "claude-cli",
      model,
      promptHash,
      inputSummary: `${row.year} ${row.make} ${row.model}`.trim(),
      response: result.output,
      latencyMs: result.latencyMs,
      selectionReason: "weekly_quality_pass",
    });

    if (!dryRun) {
      await query(
        `UPDATE boat_dna
         SET ai_summary = $2,
             documentation_status = COALESCE(documentation_status, '{}'::jsonb) || $3::jsonb
         WHERE boat_id = $1`,
        [
          row.id,
          summary,
          JSON.stringify({
            summary_source: "llm",
            summary_provider: "claude-cli",
            summary_model: model,
            llm_refreshed_at: new Date().toISOString(),
          }),
        ]
      );
    }

    updated++;
    if (updated <= 5 || updated % 50 === 0) {
      console.log(`[haiku-imports] ${updated}/${rows.length} ${row.year} ${row.make} ${row.model}`);
    }
  }

  return updated;
}

async function processMatches(limit: number, model: string, dryRun: boolean) {
  const rows = await fetchMatchRows(limit);
  let updated = 0;

  for (const row of rows) {
    const prompt = buildMatchPrompt(row);
    const promptHash = createHash("sha256").update(prompt).digest("hex").slice(0, 32);
    const result = await callClaudeHaiku(prompt, model);
    const parsed = parseJsonObject(result.output);
    if (!parsed) {
      continue;
    }

    const normalized = normalizeMatchCopy(
      parsed,
      row.current_summary ||
        `${row.year} ${row.make} ${row.model} looks aligned with the buyer, but still needs final human review.`
    );

    await logLLMResponse({
      scopeType: "match",
      scopeId: row.match_id,
      taskType: "match_copy_refresh",
      provider: "claude-cli",
      model,
      promptHash,
      inputSummary: `${row.year} ${row.make} ${row.model}`.trim(),
      response: result.output,
      latencyMs: result.latencyMs,
      selectionReason: "weekly_quality_pass",
    });

    if (!dryRun) {
      await query(
        `INSERT INTO match_explanations (
           match_id, summary, strengths, risks, confidence, provider, model
         )
         VALUES ($1, $2, $3, $4, $5, 'claude-cli', $6)
         ON CONFLICT (match_id) DO UPDATE SET
           summary = EXCLUDED.summary,
           strengths = EXCLUDED.strengths,
           risks = EXCLUDED.risks,
           confidence = EXCLUDED.confidence,
           provider = EXCLUDED.provider,
           model = EXCLUDED.model,
           updated_at = NOW()`,
        [
          row.match_id,
          normalized.summary,
          JSON.stringify(normalized.strengths),
          JSON.stringify(normalized.risks),
          normalized.confidence,
          model,
        ]
      );
    }

    updated++;
    if (updated <= 5 || updated % 50 === 0) {
      console.log(`[haiku-matches] ${updated}/${rows.length} ${row.year} ${row.make} ${row.model}`);
    }
  }

  return updated;
}

async function main() {
  const scope = parseArgValue("--scope", "both") as Scope;
  const importsLimit = parseArgInt("--imports-limit", 250);
  const matchesLimit = parseArgInt("--matches-limit", 120);
  const model = parseArgValue("--model", "haiku");
  const dryRun = hasFlag("--dry-run");
  const reindex = hasFlag("--reindex");

  let importUpdates = 0;
  let matchUpdates = 0;

  if (scope === "imports" || scope === "both") {
    importUpdates = await processImports(importsLimit, model, dryRun);
  }
  if (scope === "matches" || scope === "both") {
    matchUpdates = await processMatches(matchesLimit, model, dryRun);
  }

  let reindexed = 0;
  if (!dryRun && reindex && (scope === "imports" || scope === "both")) {
    reindexed = await reindexVisibleBoats();
  }

  console.log(
    JSON.stringify(
      {
        scope,
        model,
        importUpdates,
        matchUpdates,
        reindexed,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error("Claude Haiku copy pass failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
