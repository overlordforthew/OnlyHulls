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
import {
  boatToEmbeddingText,
  embeddingsEnabled,
  generateEmbeddings,
} from "../src/lib/ai/embeddings";
import {
  cleanImportedListingSummary,
  compressImportedListingSummary,
  shouldCompressImportedListingSummary,
} from "../src/lib/browse-summary";
import {
  buildImportedSlugFallback,
  buildImportedSlug,
  buildImportDocumentationStatus,
  buildImportedCharacterTags,
  buildImportedSummary,
  buildImportQualityFlags,
  calculateImportQualityScore,
  inferImportedVesselType,
  MIN_GOOD_SUMMARY_LENGTH,
  normalizeImportedLocation,
  normalizeImportedMakeModel,
  normalizeImportedSummary,
  resolveImportedDedupLocationText,
  sanitizeImportedDimensions,
  sanitizeImportedSpecs,
} from "../src/lib/import-quality";
import { inferLocationMarketSignals } from "../src/lib/locations/top-markets";
import { assertSourceImportAllowed } from "../src/lib/source-policy";
import { getSafeExternalUrl, getSafeExternalUrlList } from "../src/lib/url-safety";

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

interface PendingEmbedding {
  id: string;
  text: string;
}

type DbLikeError = {
  code?: string;
  constraint?: string;
  cause?: {
    code?: string;
    constraint?: string;
  };
};

const EMBEDDING_BATCH_SIZE = 24;

function isDedupConflict(err: unknown) {
  const candidate = err as DbLikeError | undefined;
  return (
    (candidate?.code === "23505" || candidate?.cause?.code === "23505") &&
    (candidate?.constraint === "idx_boats_dedup" ||
      candidate?.cause?.constraint === "idx_boats_dedup")
  );
}

function parsePrice(raw: string | number | undefined): number | null {
  if (!raw) return null;
  let s = String(raw).replace(/[^0-9.,]/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    if (/^\d{1,3}(,\d{3})+(,\d+)?$/.test(s)) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(",", ".");
    }
  } else if (hasDot && /^\d{1,3}(\.\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/\./g, "");
  }

  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : n;
}

function parseNumber(raw: string | number | undefined): number | null {
  if (!raw) return null;
  const s = String(raw);
  // Handle feet-inches: 13'10" → 13.83, 26' → 26
  const feetInches = s.match(/^(\d+)['\u2019]\s*(\d+)?[\"\u201d]?/);
  if (feetInches) {
    const feet = parseInt(feetInches[1]);
    const inches = feetInches[2] ? parseInt(feetInches[2]) : 0;
    return feet + inches / 12;
  }
  const cleaned = s.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
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
  if (year) cleaned = cleaned.replace(new RegExp(`\\s+${year}$`), "").trim();
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

function buildSpecsAndSummary(input: {
  boat: ScrapedBoat;
  year: number;
  make: string;
  model: string;
  price: number;
  currency: string;
  location: string;
  sourceName: string;
  sourceSite: string;
}) {
  const rigType = input.boat.rigging || input.boat.type || "";
  const { loa, beam, draft } = sanitizeImportedDimensions({
    make: input.make,
    model: input.model,
    sourceSite: input.sourceSite,
    rigType,
    loa: parseNumber(input.boat.length || input.boat.loa),
    beam: parseNumber(input.boat.beam),
    draft: parseNumber(input.boat.draft),
  });
  const hullMaterial = input.boat.hull || "";
  const engine = input.boat.engine || "";
  const inferredVesselType = inferImportedVesselType({
    make: input.make,
    model: input.model,
    rigType,
    existingType: input.boat.type,
  });

  const rawSpecs: Record<string, unknown> = {
    loa,
    beam,
    draft,
    rig_type: rigType,
    hull_material: hullMaterial,
    vessel_type: inferredVesselType,
    engine,
  };

  if (input.boat.displacement) rawSpecs.displacement = parseNumber(input.boat.displacement);
  if (input.boat.fuel_type) rawSpecs.fuel_type = input.boat.fuel_type;
  if (input.boat.cabins) rawSpecs.cabins = parseNumber(input.boat.cabins);
  if (input.boat.berths) rawSpecs.berths = parseNumber(input.boat.berths);
  if (input.boat.heads) rawSpecs.heads = parseNumber(input.boat.heads);
  if (input.boat.keel_type) rawSpecs.keel_type = input.boat.keel_type;
  if (input.boat.water_capacity) rawSpecs.water_capacity = parseNumber(input.boat.water_capacity);
  if (input.boat.fuel_capacity) rawSpecs.fuel_capacity = parseNumber(input.boat.fuel_capacity);

  const specs = sanitizeImportedSpecs(rawSpecs, {
    make: input.make,
    model: input.model,
    sourceSite: input.sourceSite,
  });
  const cleanedHullMaterial =
    typeof specs.hull_material === "string" ? specs.hull_material : "";
  const vesselType =
    typeof specs.vessel_type === "string" ? specs.vessel_type : inferredVesselType;

  const sourceSummary = cleanImportedListingSummary({
    summary: normalizeImportedSummary(input.boat.description),
    title: `${input.year} ${input.make}${input.model ? ` ${input.model}` : ""}`.trim(),
    locationText: input.location,
    sourceSite: input.sourceSite,
  });
  const normalizedSourceSummary = shouldCompressImportedListingSummary({
    summary: sourceSummary,
    sourceSite: input.sourceSite,
  })
    ? compressImportedListingSummary({
      summary: sourceSummary,
      sourceSite: input.sourceSite,
      maxLength: 360,
      maxSentences: 3,
    })
    : sourceSummary;
  const fallbackSummary = buildImportedSummary({
    year: input.year,
    make: input.make,
    model: input.model,
    locationText: input.location,
    loa,
    rigType,
    hullMaterial: cleanedHullMaterial,
    berths: typeof specs.berths === "number" ? specs.berths : null,
    heads: typeof specs.heads === "number" ? specs.heads : null,
  });
  const summarySource: "source" | "deterministic" =
    normalizedSourceSummary.trim().length >= MIN_GOOD_SUMMARY_LENGTH && normalizedSourceSummary === sourceSummary
      ? "source"
      : "deterministic";
  const summary =
    normalizedSourceSummary.trim().length >= MIN_GOOD_SUMMARY_LENGTH ? normalizedSourceSummary : fallbackSummary;
  const tags = buildImportedCharacterTags({
    priceUsd: toUsd(input.price, input.currency),
    loa,
    rigType,
    vesselType,
    existingTags: [],
  });

  return {
    loa,
    beam,
    draft,
    rigType,
    hullMaterial: cleanedHullMaterial,
    engine,
    specs,
    summary,
    summarySource,
    tags,
  };
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

  assertSourceImportAllowed(sourceSite, source.name);

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
  let invalidSourceUrls = 0;
  let invalidImageUrls = 0;
  const pendingEmbeddings: PendingEmbedding[] = [];

  for (const b of boats) {
    try {
      // Skip boats without a name
      if (!b.name) {
        skipped++;
        continue;
      }

      const year = parseYear(b.year);
      const price = parsePrice(b.price);
      const parsedName = parseMakeModel(b.name, year ?? undefined);
      const sourceUrl = getSafeExternalUrl(b.url);

      if (!sourceUrl) {
        invalidSourceUrls++;
        skipped++;
        continue;
      }

      // Skip if missing critical fields or suspiciously low price
      if (!year || !price || price < 500) {
        skipped++;
        continue;
      }

      const location = normalizeImportedLocation(b.location);
      const rawLoa = parseNumber(b.length || b.loa);
      const preNormalizedSlug = buildImportedSlug(year, parsedName.make, parsedName.model, location);
      const { make, model } = normalizeImportedMakeModel({
        year,
        make: parsedName.make,
        model: parsedName.model,
        slug: preNormalizedSlug,
        sourceSite,
        loa: rawLoa,
      });

      // Minimum 25ft, maximum 300ft — no dinghies, no parse errors
      const { loa } = sanitizeImportedDimensions({
        make,
        model,
        sourceSite,
        loa: rawLoa,
      });
      if (loa !== null && (loa < 25 || loa > 300)) {
        skipped++;
        continue;
      }

      // Block known dinghy/accessory/small boat makes
      const DINGHY_MAKES = /^(laser|optimist|sunfish|hobie|nacra|tohatsu|epropulsion|vanguard|bic|zim|rs sailing|mcl?aughli?n|dyer|west marine|windrider|fulcrum|winner|bluemagic|zoum|zhoum|ko sailing|o'?pen|open|club|trident|cobra)$/i;
      if (DINGHY_MAKES.test(make)) {
        skipped++;
        continue;

      }
      // Block dinghy/inflatable/accessory keywords in model
      const DINGHY_MODELS = /\b(inflatable|dinghy|optimist|opti\b|sunfish|laser\b|kayak|canoe|paddleboard|sup\b|trolling|outboard motor)\b/i;
      if (DINGHY_MODELS.test(model)) {
        skipped++;
        continue;
      }

      const slug = buildImportedSlug(year, make, model, location);

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
      const locationSignals = inferLocationMarketSignals({ locationText: location });

      // Insert with ON CONFLICT for bulletproof dedup:
      // - source_url unique index catches exact URL duplicates
      // - make+model+year+location index catches same boat from different sources
      const boat = await queryOne<{ id: string }>(
        `INSERT INTO boats (
          seller_id, slug, make, model, year, asking_price, currency,
          asking_price_usd, status, location_text, listing_source,
          source_site, source_name, source_url, is_sample, last_seen_at,
          location_country, location_region, location_market_slugs,
          location_confidence, location_approximate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, 'imported', $10, $11, $12, false, NOW(), $13, $14, $15, $16, $17)
        ON CONFLICT DO NOTHING
        RETURNING id`,
        [sellerId, finalSlug, make, model, year, price, currency,
         toUsd(price, currency), location, sourceSite, source.name, sourceUrl,
         locationSignals.country, locationSignals.region, locationSignals.marketSlugs,
         locationSignals.confidence, locationSignals.approximate]
      );

      // ON CONFLICT DO NOTHING returns null if duplicate — skip
      if (!boat) {
        skipped++;
        continue;
      }

      const { specs, summary, summarySource, tags } = buildSpecsAndSummary({
        boat: b,
        year,
        make,
        model,
        price,
        currency,
        location,
        sourceName: source.name,
        sourceSite,
      });
      const rawImages = b.images || [];
      const images = getSafeExternalUrlList(rawImages);
      invalidImageUrls += rawImages.length - images.length;
      const priceUsd = toUsd(price, currency);
      const qualityFlags = buildImportQualityFlags({
        make,
        model,
        slug: preNormalizedSlug,
        locationText: location,
        imageCount: images.length,
        priceUsd,
        summary,
      });
      const qualityScore = calculateImportQualityScore(qualityFlags);
      const documentationStatus = buildImportDocumentationStatus({
        flags: qualityFlags,
        score: qualityScore,
        summarySource,
        sourceName: source.name,
        imageCount: images.length,
        priceUsd,
      });

      await query(
        `INSERT INTO boat_dna (boat_id, specs, character_tags, ai_summary, documentation_status)
         VALUES ($1, $2, $3, $4, $5)`,
        [boat.id, JSON.stringify(specs), tags, summary, JSON.stringify(documentationStatus)]
      );

      if (embeddingsEnabled()) {
        pendingEmbeddings.push({
          id: boat.id,
          text: boatToEmbeddingText({
            make,
            model,
            year,
            asking_price: price,
            currency,
            location_text: location,
            specs,
            character_tags: tags,
            ai_summary: summary,
          }),
        });
      }

      // Insert images as boat_media
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
  const sourceUrls = boats
    .map((b) => getSafeExternalUrl(b.url))
    .filter((url): url is string => Boolean(url));
  if (sourceUrls.length > 0) {
    const updated = await query<{ id: string }>(
      `UPDATE boats SET last_seen_at = NOW(), updated_at = NOW()
       WHERE source_url = ANY($1)
       RETURNING id`,
      [sourceUrls]
    );
    console.log(`Freshness: bumped last_seen_at for ${updated.length} listings`);
  }

  if (embeddingsEnabled() && pendingEmbeddings.length > 0) {
    let embedded = 0;
    for (let index = 0; index < pendingEmbeddings.length; index += EMBEDDING_BATCH_SIZE) {
      const batch = pendingEmbeddings.slice(index, index + EMBEDDING_BATCH_SIZE);
      const embeddings = await generateEmbeddings(batch.map((item) => item.text));

      for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
        const embedding = embeddings[batchIndex];
        if (!embedding?.length) continue;

        await query("UPDATE boats SET dna_embedding = $1 WHERE id = $2", [
          `[${embedding.join(",")}]`,
          batch[batchIndex].id,
        ]);
        embedded++;
      }
    }

    console.log(`Embeddings: generated ${embedded} boat vectors`);
  }

  console.log(
    `\nImport complete: ${imported} imported, ${skipped} skipped, ${invalidSourceUrls} invalid source URLs, ${invalidImageUrls} invalid image URLs, ${errors} errors`
  );
  await pool.end();
}

async function updateBoats(filePath: string, sourceSite: string) {
  const source = SOURCES[sourceSite];
  if (!source) {
    console.error(`Unknown source: ${sourceSite}`);
    process.exit(1);
  }

  assertSourceImportAllowed(sourceSite, source.name);

  const raw = readFileSync(filePath, "utf-8");
  const boats: ScrapedBoat[] = JSON.parse(raw);
  console.log(`Update mode: ${boats.length} boats from ${filePath} (source: ${source.name})`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;
  let duplicateSkips = 0;
  let invalidSourceUrls = 0;
  let invalidImageUrls = 0;

  for (const b of boats) {
    try {
      const sourceUrl = getSafeExternalUrl(b.url);
      if (!sourceUrl) {
        invalidSourceUrls++;
        notFound++;
        continue;
      }

      // Find existing boat by source_url
      const existing = await queryOne<{
        id: string;
        make: string;
        model: string;
        year: number | null;
        location_text: string | null;
        slug: string | null;
      }>(
        "SELECT id, make, model, year, location_text, slug FROM boats WHERE source_url = $1",
        [sourceUrl]
      );
      if (!existing) { notFound++; continue; }

      const boatId = existing.id;
      const parsedYear = parseYear(b.year);
      const price = parsePrice(b.price);
      const parsedLocation = normalizeImportedLocation(b.location);
      const parsedName = b.name ? parseMakeModel(b.name, parsedYear ?? undefined) : { make: "", model: "" };
      const rawLoa = parseNumber(b.length || b.loa);
      const preNormalizedSlug = buildImportedSlug(
        parsedYear || existing.year || new Date().getUTCFullYear(),
        parsedName.make,
        parsedName.model,
        parsedLocation
      );
      const normalized = normalizeImportedMakeModel({
        year: parsedYear ?? existing.year ?? null,
        make: parsedName.make,
        model: parsedName.model,
        slug: preNormalizedSlug,
        sourceSite,
        loa: rawLoa,
      });
      const year = parsedYear ?? existing.year ?? null;
      const make = normalized.make || existing.make;
      const model = normalized.model || existing.model;
      const location = parsedLocation || normalizeImportedLocation(existing.location_text) || "";
      const targetLocationText = resolveImportedDedupLocationText(location, existing.location_text);
      const locationSignals = inferLocationMarketSignals({
        locationText: targetLocationText ?? existing.location_text ?? location,
      });
      const normalizedSlug =
        year && location ? buildImportedSlug(year, make, model, location) : null;
      const currency = detectCurrency(b);

      const { beam, draft, hullMaterial, engine, specs, summary, summarySource } = buildSpecsAndSummary({
        boat: b,
        year: year || new Date().getUTCFullYear(),
        make,
        model,
        price: price || 0,
        currency,
        location,
        sourceName: source.name,
        sourceSite,
      });

      // Upsert boat_dna
      const rawImages = b.images || [];
      const images = getSafeExternalUrlList(rawImages);
      invalidImageUrls += rawImages.length - images.length;
      const priceUsd = price ? toUsd(price, currency) : null;
      const qualityFlags = buildImportQualityFlags({
        make,
        model,
        slug: existing.slug || preNormalizedSlug,
        locationText: location,
        imageCount: images.length,
        priceUsd,
        summary,
      });
      const qualityScore = calculateImportQualityScore(qualityFlags);
      const documentationStatus = buildImportDocumentationStatus({
        flags: qualityFlags,
        score: qualityScore,
        summarySource,
        sourceName: source.name,
        imageCount: images.length,
        priceUsd,
      });

      const hasDedupKey = Boolean(make && model && year && targetLocationText !== null);
      let targetSlug = normalizedSlug;
      if (hasDedupKey) {
        const collision = await queryOne<{ id: string }>(
          `SELECT id
           FROM boats
           WHERE id <> $1
             AND listing_source = 'imported'
             AND status = 'active'
             AND make = $2
             AND model = $3
             AND year = $4
             AND location_text IS NOT DISTINCT FROM $5
           LIMIT 1`,
          [boatId, make, model, year, targetLocationText]
        );

        if (collision) {
          await query(
            `UPDATE boats
             SET last_seen_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [boatId]
          );
          duplicateSkips++;
          console.warn(`  [~] Duplicate normalized row skipped for ${sourceUrl}`);
          continue;
        }
      }

      if (normalizedSlug && normalizedSlug !== existing.slug) {
        const slugCollision = await queryOne<{ id: string }>(
          `SELECT id
           FROM boats
           WHERE id <> $1
             AND slug = $2
           LIMIT 1`,
          [boatId, normalizedSlug]
        );
        if (slugCollision) {
          const fallbackSlug = buildImportedSlugFallback(normalizedSlug, boatId);
          const fallbackCollision = await queryOne<{ id: string }>(
            `SELECT id
             FROM boats
             WHERE id <> $1
               AND slug = $2
             LIMIT 1`,
            [boatId, fallbackSlug]
          );
          if (fallbackCollision) {
            targetSlug = existing.slug;
          } else {
            targetSlug = fallbackSlug;
          }
        }
      }

      try {
        await query(
          `UPDATE boats
           SET last_seen_at = NOW(),
               updated_at = NOW(),
               make = CASE WHEN NULLIF($2, '') IS NOT NULL THEN $2 ELSE make END,
               model = CASE WHEN NULLIF($3, '') IS NOT NULL THEN $3 ELSE model END,
               year = COALESCE($4, year),
               asking_price = COALESCE($5, asking_price),
               currency = COALESCE(NULLIF($6, ''), currency),
               asking_price_usd = COALESCE($7, asking_price_usd),
               location_text = COALESCE(NULLIF($8, ''), location_text),
               slug = CASE
                 WHEN NULLIF($9, '') IS NOT NULL THEN $9
                 ELSE slug
               END,
               location_country = $10,
               location_region = $11,
               location_market_slugs = $12,
               location_confidence = $13,
               location_approximate = $14
           WHERE id = $1`,
          [
            boatId,
            make,
            model,
            year,
            price,
            currency,
            priceUsd,
            location,
            targetSlug,
            locationSignals.country,
            locationSignals.region,
            locationSignals.marketSlugs,
            locationSignals.confidence,
            locationSignals.approximate,
          ]
        );
      } catch (err) {
        if (!isDedupConflict(err)) {
          throw err;
        }

        await query(
          `UPDATE boats
           SET last_seen_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [boatId]
        );
        duplicateSkips++;
        console.warn(`  [~] Duplicate normalized row skipped for ${sourceUrl}`);
        continue;
      }

      await query(
        `INSERT INTO boat_dna (boat_id, specs, ai_summary, documentation_status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (boat_id) DO UPDATE SET
           specs = $2,
           ai_summary = CASE WHEN length($3) > 0 THEN $3 ELSE boat_dna.ai_summary END,
           documentation_status = $4`,
        [boatId, JSON.stringify(specs), summary, JSON.stringify(documentationStatus)]
      );

      // Replace images: delete old, insert new
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
      console.error(`  [!] Error updating ${b.url || "(missing url)"}: ${err}`);
    }
  }

  console.log(
    `\nUpdate complete: ${updated} updated, ${notFound} not found, ${invalidSourceUrls} invalid source URLs, ${invalidImageUrls} invalid image URLs, ${duplicateSkips} duplicate skips, ${errors} errors`
  );
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
