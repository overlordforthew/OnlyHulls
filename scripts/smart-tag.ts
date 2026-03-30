/**
 * Smart tagging via Groq free tier (Llama 3.1 70B).
 * Runs after import to enhance character_tags on boats with descriptions.
 *
 * Usage: npx tsx scripts/smart-tag.ts [limit]
 *
 * Cost: $0 (Groq free tier, 14,400 req/day)
 */

import { pool, query } from "../src/lib/db/index";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const VALID_TAGS = [
  "bluewater", "coastal-cruiser", "liveaboard-ready", "family-friendly",
  "solo-sailor", "race-ready", "weekender", "classic", "modern", "turnkey",
  "project-boat", "budget-friendly", "premium", "charter-ready",
  "motorsailer", "catamaran", "trimaran", "ketch", "cutter", "center-cockpit",
];

interface BoatToTag {
  id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  loa: number | null;
  rig_type: string;
  hull_material: string;
  description: string;
  existing_tags: string[];
}

async function tagBoat(boat: BoatToTag): Promise<string[]> {
  const parts = [
    `Boat: ${boat.year} ${boat.make} ${boat.model}`,
    `Price: $${boat.asking_price.toLocaleString()}`,
    boat.loa ? `LOA: ${boat.loa}ft` : "",
    boat.rig_type ? `Rig: ${boat.rig_type}` : "",
    boat.hull_material ? `Hull: ${boat.hull_material}` : "",
    boat.description ? `Description: ${boat.description.slice(0, 400)}` : "",
  ].filter(Boolean).join("\n");

  const prompt = `You are a sailing expert. Classify this boat with tags from this list ONLY:
${VALID_TAGS.join(", ")}

${parts}

Return ONLY a comma-separated list of 2-5 tags. No explanation.`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 100,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err}`);
  }

  const data = await res.json();
  const response = data.choices?.[0]?.message?.content?.trim() || "";

  // Parse comma-separated tags, validate against allowed list
  const tags: string[] = response
    .toLowerCase()
    .split(/[,\n]+/)
    .map((t: string) => t.trim().replace(/[^a-z-]/g, ""))
    .filter((t: string) => VALID_TAGS.includes(t));

  return [...new Set(tags)];
}

async function main() {
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY not set");
    process.exit(1);
  }

  const limit = parseInt(process.argv[2] || "50");

  // Find boats with descriptions but few/weak tags
  const boats = await query<BoatToTag>(
    `SELECT b.id, b.make, b.model, b.year, b.asking_price::float as asking_price,
            (d.specs->>'loa')::float as loa,
            COALESCE(d.specs->>'rig_type', '') as rig_type,
            COALESCE(d.specs->>'hull_material', '') as hull_material,
            COALESCE(d.ai_summary, '') as description,
            COALESCE(d.character_tags, '{}') as existing_tags
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
       AND (array_length(d.character_tags, 1) IS NULL OR array_length(d.character_tags, 1) < 3)
     ORDER BY b.created_at DESC
     LIMIT $1`,
    [limit]
  );

  console.log(`Found ${boats.length} boats needing better tags (limit: ${limit})`);

  let tagged = 0;
  let errors = 0;

  for (const boat of boats) {
    try {
      const tags = await tagBoat(boat);
      if (tags.length > 0) {
        await query(
          `UPDATE boat_dna SET character_tags = $1 WHERE boat_id = $2`,
          [tags, boat.id]
        );
        console.log(`  [+] ${boat.year} ${boat.make} ${boat.model}: ${tags.join(", ")}`);
        tagged++;
      }

      // Respect rate limit: 30 req/min on free tier
      await new Promise((r) => setTimeout(r, 2100));
    } catch (err) {
      console.error(`  [!] ${boat.make} ${boat.model}: ${err}`);
      errors++;
      // Back off on rate limit errors
      if (String(err).includes("429")) {
        console.log("  Rate limited — waiting 60s...");
        await new Promise((r) => setTimeout(r, 60000));
      }
    }
  }

  console.log(`\nTagging complete: ${tagged} tagged, ${errors} errors`);
  await pool.end();
}

main().catch((err) => {
  console.error("Smart tag failed:", err);
  process.exit(1);
});
