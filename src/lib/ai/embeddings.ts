import OpenAI from "openai";
import { logger } from "@/lib/logger";
import { openAIEnabled } from "@/lib/capabilities";

export function embeddingsEnabled(): boolean {
  return openAIEnabled();
}

function getOpenAI() {
  if (!embeddingsEnabled()) {
    throw new Error("OpenAI embeddings are not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 1536,
    });
    return response.data[0].embedding;
  } catch (err) {
    logger.error({ err, inputLength: text.length }, "OpenAI embedding generation failed");
    throw new Error("Failed to generate embedding");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function profileToEmbeddingText(profile: any): string {
  // Convert structured profile to natural language for embedding
  const parts: string[] = [];

  if (profile.use_case) {
    parts.push(`Use case: ${(profile.use_case as string[]).join(", ")}`);
  }
  if (profile.budget_range) {
    const b = profile.budget_range as Record<string, unknown>;
    parts.push(
      `Budget: ${b.min}-${b.max} ${b.currency}, refit budget ${b.refit_budget}`
    );
  }
  if (profile.boat_type_prefs) {
    const bt = profile.boat_type_prefs as Record<string, string[]>;
    if (bt.types?.length) parts.push(`Boat types: ${bt.types.join(", ")}`);
    if (bt.rig_prefs?.length)
      parts.push(`Rig preferences: ${bt.rig_prefs.join(", ")}`);
    if (bt.hull_prefs?.length)
      parts.push(`Hull preferences: ${bt.hull_prefs.join(", ")}`);
  }
  if (profile.spec_preferences) {
    const sp = profile.spec_preferences as Record<string, unknown>;
    const specs: string[] = [];
    if (sp.loa_min || sp.loa_max)
      specs.push(`LOA ${sp.loa_min || "?"}-${sp.loa_max || "?"}ft`);
    if (sp.draft_max) specs.push(`max draft ${sp.draft_max}ft`);
    if (sp.year_min) specs.push(`year ${sp.year_min}+`);
    if (sp.engine_type) specs.push(`${sp.engine_type} engine`);
    if (specs.length) parts.push(`Specs: ${specs.join(", ")}`);
  }
  if (profile.location_prefs) {
    const lp = profile.location_prefs as Record<string, unknown>;
    if (lp.home_port) parts.push(`Home port: ${lp.home_port}`);
    if ((lp.regions as string[])?.length)
      parts.push(`Preferred regions: ${(lp.regions as string[]).join(", ")}`);
  }
  if (profile.experience_level) {
    parts.push(`Experience: ${profile.experience_level}`);
  }
  if ((profile.deal_breakers as string[])?.length) {
    parts.push(
      `Deal breakers: ${(profile.deal_breakers as string[]).join(", ")}`
    );
  }
  if (profile.timeline) parts.push(`Timeline: ${profile.timeline}`);
  if (profile.refit_tolerance)
    parts.push(`Refit tolerance: ${profile.refit_tolerance}`);

  return parts.join(". ");
}

export function boatToEmbeddingText(boat: Record<string, unknown>): string {
  const parts: string[] = [];

  if (boat.make) parts.push(`${boat.year} ${boat.make} ${boat.model}`);
  if (boat.asking_price)
    parts.push(`Asking price: ${boat.asking_price} ${boat.currency || "USD"}`);
  if (boat.location_text) parts.push(`Location: ${boat.location_text}`);

  const specs = boat.specs as Record<string, unknown> | undefined;
  if (specs) {
    const specParts: string[] = [];
    if (specs.loa) specParts.push(`LOA ${specs.loa}ft`);
    if (specs.beam) specParts.push(`beam ${specs.beam}ft`);
    if (specs.draft) specParts.push(`draft ${specs.draft}ft`);
    if (specs.rig_type) specParts.push(`${specs.rig_type} rig`);
    if (specs.hull_material) specParts.push(`${specs.hull_material} hull`);
    if (specs.engine) specParts.push(`${specs.engine}`);
    if (specs.cabins) specParts.push(`${specs.cabins} cabins`);
    if (specs.displacement) specParts.push(`${specs.displacement}kg displacement`);
    if (specs.keel_type) specParts.push(`${specs.keel_type} keel`);
    if (specParts.length) parts.push(`Specs: ${specParts.join(", ")}`);
  }

  const tags = boat.character_tags as string[] | undefined;
  if (tags?.length) parts.push(`Character: ${tags.join(", ")}`);

  if (boat.ai_summary) parts.push(boat.ai_summary as string);

  return parts.join(". ");
}
