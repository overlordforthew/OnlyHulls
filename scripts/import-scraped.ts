/**
 * Import scraped boat JSON into the OnlyHulls database.
 *
 * Usage:
 *   npx tsx scripts/import-scraped.ts <json-file> [source]
 *
 * Examples:
 *   npx tsx scripts/import-scraped.ts scraped_boats.json boats_com
 *   npx tsx scripts/import-scraped.ts /tmp/scraped_boats.json sailboatlistings
 *
 * Sources: boats_com, sailboatlistings, yachtworld, craigslist
 */

import { readFileSync } from "fs";
import { pool, query, queryOne } from "../src/lib/db/index";

// Source registry — add new sources here
const SOURCES: Record<string, { name: string; domain: string }> = {
  boats_com: { name: "Boats.com", domain: "boats.com" },
  sailboatlistings: { name: "Sailboat Listings", domain: "sailboatlistings.com" },
  yachtworld: { name: "YachtWorld", domain: "yachtworld.com" },
  theyachtmarket: { name: "TheYachtMarket", domain: "theyachtmarket.com" },
  apolloduck: { name: "Apollo Duck", domain: "apolloduck.com" },
  boatcrazy: { name: "BoatCrazy", domain: "boatcrazy.com" },
  craigslist: { name: "Craigslist", domain: "craigslist.org" },
};

interface ScrapedBoat {
  name?: string;
  year?: string | number;
  price?: string | number;
  length?: string | number;
  loa?: string | number;
  beam?: string | number;
  draft?: string | number;
  location?: string;
  hull?: string;
  engine?: string;
  rigging?: string;
  type?: string;
  description?: string;
  url?: string;
  images?: string[];
  id?: string;
}

function parsePrice(raw: string | number | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).replace(/[^0-9.]/g, "");
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : n;
}

function parseNumber(raw: string | number | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).replace(/[^0-9.]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseYear(raw: string | number | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(String(raw));
  return n >= 1900 && n <= 2030 ? n : null;
}

function parseMakeModel(name: string, year?: number): { make: string; model: string } {
  let cleaned = name.trim();
  // Strip leading year if present (e.g. "1979 catalina 30 sailboat" → "catalina 30 sailboat")
  if (year) cleaned = cleaned.replace(new RegExp(`^${year}\\s+`), "");
  // Strip trailing "sailboat", "yacht", "for sale" noise
  cleaned = cleaned.replace(/\s+(sailboat|yacht|for sale|boat)$/i, "").trim();
  // Capitalize first letter of each word
  cleaned = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { make: parts[0], model: "" };
  return { make: parts[0], model: parts.slice(1).join(" ") };
}

function detectCurrency(priceStr: string | undefined): string {
  if (!priceStr) return "USD";
  const s = String(priceStr);
  if (s.includes("€") || s.includes("EUR")) return "EUR";
  if (s.includes("£") || s.includes("GBP")) return "GBP";
  return "USD";
}

function generateSlug(year: number, make: string, model: string, location: string): string {
  return [year, make, model, location.split(",")[0]]
    .map((p) => String(p).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""))
    .join("-");
}

async function ensureSystemSeller(): Promise<string> {
  let seller = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = 'system@onlyhulls.com'"
  );
  if (!seller) {
    seller = await queryOne<{ id: string }>(
      `INSERT INTO users (email, display_name, role, subscription_tier)
       VALUES ('system@onlyhulls.com', 'OnlyHulls Team', 'seller', 'featured')
       RETURNING id`
    );
  }
  return seller!.id;
}

async function importBoats(filePath: string, sourceSite: string) {
  const source = SOURCES[sourceSite];
  if (!source) {
    console.error(`Unknown source: ${sourceSite}. Valid: ${Object.keys(SOURCES).join(", ")}`);
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf-8");
  const boats: ScrapedBoat[] = JSON.parse(raw);
  console.log(`Loaded ${boats.length} boats from ${filePath} (source: ${source.name})`);

  if (boats.length === 0) {
    console.log("Nothing to import.");
    await pool.end();
    return;
  }

  const sellerId = await ensureSystemSeller();
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const b of boats) {
    try {
      // Skip boats without a name
      if (!b.name) {
        skipped++;
        continue;
      }

      const year = parseYear(b.year);
      const price = parsePrice(b.price);
      const { make, model } = parseMakeModel(b.name, year ?? undefined);

      // Skip if missing critical fields
      if (!year || !price) {
        skipped++;
        continue;
      }

      const location = b.location || "";
      const sourceUrl = b.url || "";

      const slug = generateSlug(year, make, model, location);

      // Unique slug — append random suffix on collision
      let finalSlug = slug;
      const slugExists = await queryOne<{ id: string }>(
        "SELECT id FROM boats WHERE slug = $1",
        [finalSlug]
      );
      if (slugExists) {
        finalSlug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      }

      const currency = detectCurrency(String(b.price));

      // Insert with ON CONFLICT for bulletproof dedup:
      // - source_url unique index catches exact URL duplicates
      // - make+model+year+location index catches same boat from different sources
      const boat = await queryOne<{ id: string }>(
        `INSERT INTO boats (
          seller_id, slug, make, model, year, asking_price, currency,
          status, location_text, listing_source, source_site, source_name,
          source_url, is_sample
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, 'imported', $9, $10, $11, false)
        ON CONFLICT DO NOTHING
        RETURNING id`,
        [sellerId, finalSlug, make, model, year, price, currency,
         location, sourceSite, source.name, sourceUrl]
      );

      // ON CONFLICT DO NOTHING returns null if duplicate — skip
      if (!boat) {
        skipped++;
        continue;
      }

      // Insert boat_dna
      const loa = parseNumber(b.length || b.loa);
      const beam = parseNumber(b.beam);
      const draft = parseNumber(b.draft);
      const rigType = b.rigging || b.type || "";
      const hullMaterial = b.hull || "";
      const engine = b.engine || "";
      // Clean up descriptions with HTML artifacts
      let desc = (b.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^["'\s]+/, "")
        .replace(/\bcontent=.*$/i, "")
        .trim();
      if (desc.length < 20) desc = "";

      // Auto-tag based on available data
      const tags: string[] = [];
      if (price < 50000) tags.push("budget-friendly");
      if (price >= 200000) tags.push("premium");
      if (loa && loa >= 40) tags.push("bluewater");
      if (loa && loa < 30) tags.push("weekender");
      if (rigType.toLowerCase().includes("cutter")) tags.push("bluewater");
      if (rigType.toLowerCase().includes("ketch")) tags.push("classic");

      await query(
        `INSERT INTO boat_dna (boat_id, specs, character_tags, ai_summary)
         VALUES ($1, $2, $3, $4)`,
        [
          boat.id,
          JSON.stringify({
            loa, beam, draft,
            rig_type: rigType,
            hull_material: hullMaterial,
            engine,
          }),
          tags,
          desc,
        ]
      );

      // Insert images as boat_media
      const images = b.images || [];
      for (let i = 0; i < images.length; i++) {
        await query(
          `INSERT INTO boat_media (boat_id, type, url, sort_order)
           VALUES ($1, 'image', $2, $3)`,
          [boat.id, images[i], i]
        );
      }

      imported++;
      const imgCount = images.length;
      console.log(`  [+] ${year} ${make} ${model} | $${price.toLocaleString()} | ${location} | ${imgCount} photos | ${source.name}`);

    } catch (err) {
      errors++;
      console.error(`  [!] Error importing ${b.name}: ${err}`);
    }
  }

  console.log(`\nImport complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  await pool.end();
}

// CLI
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: npx tsx scripts/import-scraped.ts <json-file> <source>");
  console.log(`Sources: ${Object.keys(SOURCES).join(", ")}`);
  process.exit(1);
}

importBoats(args[0], args[1]).catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
