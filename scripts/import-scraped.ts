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
  boattrader: { name: "Boat Trader", domain: "boattrader.com" },
  sailboatlistings: { name: "Sailboat Listings", domain: "sailboatlistings.com" },
  yachtworld: { name: "YachtWorld", domain: "yachtworld.com" },
  theyachtmarket: { name: "TheYachtMarket", domain: "theyachtmarket.com" },
  apolloduck: { name: "Apollo Duck", domain: "apolloduck.com" },
  boatcrazy: { name: "BoatCrazy", domain: "boatcrazy.com" },
  catamarans_com: { name: "Catamarans.com", domain: "catamarans.com" },
  moorings: { name: "Moorings Brokerage", domain: "mooringsbrokerage.com" },
  dreamyacht: { name: "Dream Yacht Sales", domain: "dreamyachtsales.com" },
  denison: { name: "Denison Yachting", domain: "denisonyachtsales.com" },
  multihullworld: { name: "Multihull World", domain: "multihullworld.com" },
  apolloduck_us: { name: "Apollo Duck US", domain: "apolloduck.us" },
  catamaransite: { name: "CatamaranSite", domain: "catamaransite.com" },
  multihullcompany: { name: "Multihull Company", domain: "multihullcompany.com" },
  camperandnicholsons: { name: "Camper & Nicholsons", domain: "camperandnicholsons.com" },
  vi_yachtbroker: { name: "VI Yacht Broker", domain: "virginislandsyachtbroker.com" },
  boote_yachten: { name: "Boote & Yachten", domain: "boote-yachten.de" },
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
  currency?: string;
  displacement?: string | number;
  fuel_type?: string;
  cabins?: string | number;
  berths?: string | number;
  heads?: string | number;
  keel_type?: string;
  water_capacity?: string | number;
  fuel_capacity?: string | number;
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
  // Strip trailing noise words
  cleaned = cleaned.replace(/\s+(sailboat|yacht|for sale|boat)$/i, "").trim();
  // Strip price bleed: anything starting with currency symbol (e.g. "Sadler 32 £24,000")
  cleaned = cleaned.replace(/\s+[£$€][\d,]+.*$/, "").trim();
  // Strip parenthetical year: "Beneteau 211 (2001)"
  cleaned = cleaned.replace(/\s*\(\d{4}\)\s*$/, "").trim();
  // Strip trailing periods, dots
  cleaned = cleaned.replace(/[\s.]+$/, "").trim();
  // Capitalize first letter of each word
  cleaned = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { make: parts[0], model: "" };

  // If first word is 1-2 chars, merge with next word for proper make name
  // "J Boats J30" → make="J Boats", model="J30"
  // "X Yachts X4 9" → make="X Yachts", model="X4 9"
  let make = parts[0];
  let modelStart = 1;
  if (make.length <= 2 && parts.length >= 3) {
    make = `${parts[0]} ${parts[1]}`;
    modelStart = 2;
  }

  return { make, model: parts.slice(modelStart).join(" ") };
}

function detectCurrency(boat: ScrapedBoat): string {
  // Prefer explicit currency code from scraper (e.g. TYM OG meta)
  if (boat.currency) {
    const c = boat.currency.toUpperCase();
    if (USD_RATES[c]) return c;
  }
  // Fallback: detect from price string
  const s = String(boat.price || "");
  if (s.includes("€") || s.includes("EUR")) return "EUR";
  if (s.includes("£") || s.includes("GBP")) return "GBP";
  return "USD";
}

// Approximate conversion rates — updated periodically, good enough for comparison
const USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.26,
  AUD: 0.65,
  CAD: 0.74,
  NZD: 0.60,
  SEK: 0.095,
  DKK: 0.145,
  NOK: 0.092,
};

function toUsd(price: number, currency: string): number {
  const rate = USD_RATES[currency] || 1;
  return Math.round(price * rate);
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

      // Skip if missing critical fields or suspiciously low price
      if (!year || !price || price < 500) {
        skipped++;
        continue;
      }

      // Minimum 25ft — no dinghies, daysailers, or racing boats
      const loa = parseNumber(b.length || b.loa);
      if (loa !== null && loa < 25) {
        skipped++;
        continue;
      }

      // Block known dinghy/accessory makes that slip through without LOA
      const DINGHY_MAKES = /^(laser|optimist|sunfish|hobie|nacra|tohatsu|epropulsion|vanguard|bic|zim|rs sailing)$/i;
      if (DINGHY_MAKES.test(make)) {
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

      const currency = detectCurrency(b);

      // Insert with ON CONFLICT for bulletproof dedup:
      // - source_url unique index catches exact URL duplicates
      // - make+model+year+location index catches same boat from different sources
      const boat = await queryOne<{ id: string }>(
        `INSERT INTO boats (
          seller_id, slug, make, model, year, asking_price, currency,
          asking_price_usd, status, location_text, listing_source,
          source_site, source_name, source_url, is_sample, last_seen_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, 'imported', $10, $11, $12, false, NOW())
        ON CONFLICT DO NOTHING
        RETURNING id`,
        [sellerId, finalSlug, make, model, year, price, currency,
         toUsd(price, currency), location, sourceSite, source.name, sourceUrl]
      );

      // ON CONFLICT DO NOTHING returns null if duplicate — skip
      if (!boat) {
        skipped++;
        continue;
      }

      // Insert boat_dna
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

      const specs: Record<string, unknown> = {
        loa, beam, draft,
        rig_type: rigType,
        hull_material: hullMaterial,
        engine,
      };
      // Extended specs from detail-page scrapers
      if (b.displacement) specs.displacement = parseNumber(b.displacement);
      if (b.fuel_type) specs.fuel_type = b.fuel_type;
      if (b.cabins) specs.cabins = parseNumber(b.cabins);
      if (b.berths) specs.berths = parseNumber(b.berths);
      if (b.heads) specs.heads = parseNumber(b.heads);
      if (b.keel_type) specs.keel_type = b.keel_type;
      if (b.water_capacity) specs.water_capacity = parseNumber(b.water_capacity);
      if (b.fuel_capacity) specs.fuel_capacity = parseNumber(b.fuel_capacity);

      await query(
        `INSERT INTO boat_dna (boat_id, specs, character_tags, ai_summary)
         VALUES ($1, $2, $3, $4)`,
        [boat.id, JSON.stringify(specs), tags, desc]
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

  // Bump last_seen_at for ALL boats in this scrape batch (new + existing)
  // This is how we track freshness — boats that stop appearing in scrapes
  // will have stale last_seen_at and get expired after 14 days
  const sourceUrls = boats.map((b) => b.url).filter(Boolean);
  if (sourceUrls.length > 0) {
    const updated = await query<{ id: string }>(
      `UPDATE boats SET last_seen_at = NOW(), updated_at = NOW()
       WHERE source_url = ANY($1)
       RETURNING id`,
      [sourceUrls]
    );
    console.log(`Freshness: bumped last_seen_at for ${updated.length} listings`);
  }

  console.log(`\nImport complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  await pool.end();
}

async function updateBoats(filePath: string, sourceSite: string) {
  const source = SOURCES[sourceSite];
  if (!source) {
    console.error(`Unknown source: ${sourceSite}`);
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf-8");
  const boats: ScrapedBoat[] = JSON.parse(raw);
  console.log(`Update mode: ${boats.length} boats from ${filePath} (source: ${source.name})`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const b of boats) {
    try {
      if (!b.url) { notFound++; continue; }

      // Find existing boat by source_url
      const existing = await queryOne<{ id: string }>(
        "SELECT id FROM boats WHERE source_url = $1",
        [b.url]
      );
      if (!existing) { notFound++; continue; }

      const boatId = existing.id;

      // Build updated specs
      const beam = parseNumber(b.beam);
      const draft = parseNumber(b.draft);
      const loa = parseNumber(b.length || b.loa);
      const rigType = b.rigging || b.type || "";
      const hullMaterial = b.hull || "";
      const engine = b.engine || "";
      const specs: Record<string, unknown> = {
        loa, beam, draft,
        rig_type: rigType,
        hull_material: hullMaterial,
        engine,
      };
      if (b.displacement) specs.displacement = parseNumber(b.displacement);
      if (b.fuel_type) specs.fuel_type = b.fuel_type;
      if (b.cabins) specs.cabins = parseNumber(b.cabins);
      if (b.berths) specs.berths = parseNumber(b.berths);
      if (b.heads) specs.heads = parseNumber(b.heads);
      if (b.keel_type) specs.keel_type = b.keel_type;
      if (b.water_capacity) specs.water_capacity = parseNumber(b.water_capacity);
      if (b.fuel_capacity) specs.fuel_capacity = parseNumber(b.fuel_capacity);

      let desc = (b.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^["'\s]+/, "")
        .replace(/\bcontent=.*$/i, "")
        .trim();
      if (desc.length < 20) desc = "";

      // Upsert boat_dna
      await query(
        `INSERT INTO boat_dna (boat_id, specs, ai_summary)
         VALUES ($1, $2, $3)
         ON CONFLICT (boat_id) DO UPDATE SET
           specs = $2, ai_summary = CASE WHEN length($3) > 0 THEN $3 ELSE boat_dna.ai_summary END`,
        [boatId, JSON.stringify(specs), desc]
      );

      // Replace images: delete old, insert new
      const images = b.images || [];
      if (images.length > 0) {
        await query("DELETE FROM boat_media WHERE boat_id = $1", [boatId]);
        for (let i = 0; i < images.length; i++) {
          await query(
            `INSERT INTO boat_media (boat_id, type, url, sort_order)
             VALUES ($1, 'image', $2, $3)`,
            [boatId, images[i], i]
          );
        }
      }

      updated++;
      const name = b.name || "?";
      const n_imgs = images.length;
      const n_specs = [beam, draft, hullMaterial, engine, b.cabins, b.displacement]
        .filter(Boolean).length;
      if (updated % 50 === 0 || updated <= 3) {
        console.log(`  [~] ${name} | ${n_imgs} imgs | ${n_specs}/6 specs`);
      }
    } catch (err) {
      errors++;
      console.error(`  [!] Error updating ${b.url}: ${err}`);
    }
  }

  console.log(`\nUpdate complete: ${updated} updated, ${notFound} not found, ${errors} errors`);
  await pool.end();
}

// CLI
const args = process.argv.slice(2);
const updateMode = args.includes("--update");
const filteredArgs = args.filter(a => a !== "--update");

if (filteredArgs.length < 2) {
  console.log("Usage: npx tsx scripts/import-scraped.ts <json-file> <source> [--update]");
  console.log(`Sources: ${Object.keys(SOURCES).join(", ")}`);
  process.exit(1);
}

const fn = updateMode ? updateBoats : importBoats;
fn(filteredArgs[0], filteredArgs[1]).catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
