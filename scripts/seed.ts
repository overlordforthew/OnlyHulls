import { pool, query, queryOne } from "../src/lib/db/index";

const BOATS = [
  { make: "Beneteau", model: "Oceanis 40.1", year: 2020, price: 275000, currency: "USD", location: "Annapolis, MD", loa: 39.4, beam: 13.1, draft: 6.7, rig: "sloop", hull: "fiberglass", engine: "Yanmar 45HP diesel", berths: 6, heads: 2, condition: 8, tags: ["coastal-cruiser", "family-friendly", "modern"], desc: "Well-maintained 2020 Oceanis 40.1 with low engine hours. Full electronics package including Raymarine chartplotter, autopilot, and radar. Ready for coastal cruising or weekend sailing." },
  { make: "Hallberg-Rassy", model: "44", year: 2005, price: 345000, currency: "USD", location: "Gothenburg, Sweden", loa: 44, beam: 13.5, draft: 6.2, rig: "sloop", hull: "fiberglass", engine: "Volvo Penta 75HP diesel", berths: 7, heads: 2, condition: 7, tags: ["bluewater", "liveaboard-ready", "classic"], desc: "Legendary Hallberg-Rassy 44 — the quintessential bluewater cruiser. Center cockpit design, teak interior, and proven offshore capability. Circumnavigation-ready." },
  { make: "Catalina", model: "36 MkII", year: 2001, price: 78000, currency: "USD", location: "San Diego, CA", loa: 36, beam: 11.9, draft: 5.8, rig: "sloop", hull: "fiberglass", engine: "Universal M35B diesel", berths: 5, heads: 1, condition: 6, tags: ["weekender", "budget-friendly", "coastal-cruiser"], desc: "Popular Catalina 36 MkII in good condition. Great first boat for coastal cruising. New standing rigging 2020, bottom paint 2024." },
  { make: "Jeanneau", model: "Sun Odyssey 440", year: 2019, price: 310000, currency: "USD", location: "Fort Lauderdale, FL", loa: 44.3, beam: 14.1, draft: 6.9, rig: "sloop", hull: "fiberglass", engine: "Yanmar 57HP diesel", berths: 8, heads: 2, condition: 9, tags: ["coastal-cruiser", "family-friendly", "modern", "turnkey"], desc: "Nearly new Jeanneau Sun Odyssey 440 with every option. Walk-through transom, twin helm stations, full B&G electronics. Charter-ready or private cruising." },
  { make: "Island Packet", model: "370", year: 2007, price: 225000, currency: "USD", location: "Stuart, FL", loa: 37, beam: 12.6, draft: 4.5, rig: "cutter", hull: "fiberglass", engine: "Yanmar 56HP diesel", berths: 6, heads: 1, condition: 7, tags: ["bluewater", "liveaboard-ready", "classic"], desc: "Island Packet 370 — shallow draft bluewater cruiser. Full keel, cutter rig, and solid fiberglass hull. Perfect for the ICW and Caribbean cruising." },
  { make: "Lagoon", model: "42", year: 2015, price: 410000, currency: "USD", location: "St. Martin, Caribbean", loa: 42.3, beam: 25.3, draft: 4.3, rig: "sloop", hull: "fiberglass", engine: "2x Yanmar 40HP diesel", berths: 10, heads: 4, condition: 8, tags: ["liveaboard-ready", "family-friendly", "modern"], desc: "Spacious Lagoon 42 catamaran. Owner's version with 3 cabins. Excellent charter or liveaboard platform with generator and watermaker." },
  { make: "Hans Christian", model: "38T", year: 1987, price: 95000, currency: "USD", location: "Seattle, WA", loa: 38, beam: 11.8, draft: 5.5, rig: "cutter", hull: "fiberglass", engine: "Perkins 4-108 diesel", berths: 5, heads: 1, condition: 5, tags: ["bluewater", "classic", "project-boat"], desc: "Classic Hans Christian 38T double-ender. Heavy displacement cutter rig built for ocean crossings. Needs updated electronics and some cosmetic work." },
  { make: "Hanse", model: "458", year: 2018, price: 298000, currency: "EUR", location: "Palma de Mallorca, Spain", loa: 45.9, beam: 14.4, draft: 7.2, rig: "sloop", hull: "fiberglass", engine: "Volvo D2-60 diesel", berths: 8, heads: 2, condition: 8, tags: ["modern", "race-ready", "coastal-cruiser"], desc: "Fast and elegant Hanse 458. Performance cruiser with carbon sprit and self-tacking jib. Mediterranean cruising ready with full Garmin electronics." },
  { make: "Amel", model: "Super Maramu", year: 2000, price: 220000, currency: "EUR", location: "La Rochelle, France", loa: 53, beam: 15, draft: 5.8, rig: "ketch", hull: "fiberglass", engine: "Volvo TMD22 diesel", berths: 6, heads: 2, condition: 7, tags: ["bluewater", "liveaboard-ready", "classic"], desc: "The legendary Amel Super Maramu — a proven passage maker. In-mast furling, center cockpit, and the famous Amel electric winch system. Atlantic-tested." },
  { make: "Tayana", model: "37", year: 1985, price: 65000, currency: "USD", location: "Honolulu, HI", loa: 37, beam: 11.5, draft: 5.5, rig: "cutter", hull: "fiberglass", engine: "Perkins 4-108 diesel", berths: 5, heads: 1, condition: 5, tags: ["bluewater", "classic", "budget-friendly"], desc: "Tayana 37 Pilothouse — Hawaii-based and Pacific-proven. Solid fiberglass hull, traditional lines. Great project boat for an experienced sailor." },
  { make: "Bavaria", model: "Cruiser 46", year: 2016, price: 195000, currency: "EUR", location: "Lefkada, Greece", loa: 46, beam: 14.3, draft: 6.6, rig: "sloop", hull: "fiberglass", engine: "Volvo D2-55 diesel", berths: 8, heads: 3, condition: 7, tags: ["coastal-cruiser", "family-friendly", "modern"], desc: "Spacious Bavaria Cruiser 46 in the heart of Greek sailing waters. 3-cabin layout, well-maintained by charter company. Ready for private use." },
  { make: "Contest", model: "42CS", year: 2008, price: 285000, currency: "EUR", location: "IJmuiden, Netherlands", loa: 42.3, beam: 13.1, draft: 6.5, rig: "sloop", hull: "fiberglass", engine: "Volvo Penta D2-55 diesel", berths: 6, heads: 2, condition: 8, tags: ["bluewater", "classic", "turnkey"], desc: "Dutch-built Contest 42CS — premium quality bluewater cruiser. Center cockpit, teak decks, Lewmar winches. Meticulously maintained by single owner." },
  { make: "Oyster", model: "485", year: 2010, price: 450000, currency: "GBP", location: "Hamble, UK", loa: 48.5, beam: 14.6, draft: 7.5, rig: "sloop", hull: "fiberglass", engine: "Yanmar 110HP diesel", berths: 6, heads: 2, condition: 9, tags: ["bluewater", "turnkey", "modern"], desc: "Prestigious Oyster 485 in impeccable condition. Bow thruster, watermaker, generator, full Raymarine electronics. Ready for world cruising." },
  { make: "Morgan", model: "Out Island 41", year: 1978, price: 38000, currency: "USD", location: "Key West, FL", loa: 41, beam: 12.5, draft: 4.5, rig: "ketch", hull: "fiberglass", engine: "Perkins diesel", berths: 6, heads: 2, condition: 4, tags: ["project-boat", "liveaboard-ready", "budget-friendly"], desc: "Classic Morgan Out Island 41 ketch. Great bones, needs TLC. Center cockpit liveaboard with tons of space. Perfect for a motivated refit." },
  { make: "Dufour", model: "390 Grand Large", year: 2021, price: 245000, currency: "EUR", location: "Olbia, Sardinia", loa: 39.3, beam: 13.1, draft: 6.5, rig: "sloop", hull: "fiberglass", engine: "Volvo D1-30 diesel", berths: 6, heads: 2, condition: 9, tags: ["modern", "coastal-cruiser", "turnkey"], desc: "Low-hours 2021 Dufour 390 Grand Large. Mediterranean spec with bimini, sprayhood, bow thruster. 3-cabin owner's layout. Like new." },
  { make: "Hylas", model: "46", year: 2012, price: 385000, currency: "USD", location: "Newport, RI", loa: 46, beam: 14.2, draft: 6.8, rig: "sloop", hull: "fiberglass", engine: "Yanmar 75HP diesel", berths: 6, heads: 2, condition: 8, tags: ["bluewater", "turnkey", "classic"], desc: "Hylas 46 — Queen Long Marine's finest semi-custom bluewater cruiser. Teak interior, Spectra watermaker, SSB radio. East Coast to Caribbean ready." },
  { make: "Leopard", model: "45", year: 2017, price: 499000, currency: "USD", location: "Tortola, BVI", loa: 44.8, beam: 25, draft: 4.3, rig: "sloop", hull: "fiberglass", engine: "2x Yanmar 45HP diesel", berths: 8, heads: 4, condition: 8, tags: ["liveaboard-ready", "family-friendly", "modern"], desc: "Robertson & Caine Leopard 45 catamaran. Owner's version, never chartered. Generator, watermaker, solar panels. Caribbean-ready multihull." },
  { make: "Hunter", model: "36", year: 2006, price: 89000, currency: "USD", location: "Chicago, IL", loa: 36, beam: 12.5, draft: 5.7, rig: "sloop", hull: "fiberglass", engine: "Yanmar 27HP diesel", berths: 5, heads: 1, condition: 6, tags: ["weekender", "family-friendly", "budget-friendly"], desc: "Well-kept Hunter 36 on Lake Michigan. B&G instruments, Lewmar self-tailing winches. Great Great Lakes weekender and coastal cruiser." },
  { make: "Wauquiez", model: "Pilot Saloon 47", year: 2005, price: 290000, currency: "EUR", location: "Marseille, France", loa: 47, beam: 14.1, draft: 6.2, rig: "sloop", hull: "fiberglass", engine: "Volvo Penta 75HP diesel", berths: 6, heads: 2, condition: 7, tags: ["bluewater", "liveaboard-ready", "classic"], desc: "Deck saloon bluewater cruiser with incredible interior volume. Pilothouse helm station perfect for cold-weather sailing. Atlantic crossing veteran." },
  { make: "Pearson", model: "36-2", year: 1989, price: 42000, currency: "USD", location: "Mystic, CT", loa: 36, beam: 11.8, draft: 5.8, rig: "sloop", hull: "fiberglass", engine: "Universal M-25 diesel", berths: 5, heads: 1, condition: 5, tags: ["classic", "weekender", "budget-friendly"], desc: "Classic Pearson 36-2 — a solid New England design. Recent diesel rebuild, new sails 2022. Perfect for learning and coastal sailing." },
  { make: "Najad", model: "440", year: 2003, price: 265000, currency: "EUR", location: "Orust, Sweden", loa: 44, beam: 13.1, draft: 6.4, rig: "cutter", hull: "fiberglass", engine: "Volvo Penta 75HP diesel", berths: 6, heads: 2, condition: 8, tags: ["bluewater", "turnkey", "classic"], desc: "Swedish-built Najad 440 cutter — the epitome of quality. Center cockpit, heated interior, teak decks. Maintained to the highest standard." },
  { make: "Beneteau", model: "First 36.7", year: 2003, price: 72000, currency: "USD", location: "San Francisco, CA", loa: 36.7, beam: 12, draft: 6.6, rig: "sloop", hull: "fiberglass", engine: "Yanmar 29HP diesel", berths: 6, heads: 1, condition: 6, tags: ["race-ready", "weekender", "modern"], desc: "Fast Beneteau First 36.7 — competitive IRC racer that's also comfortable for weekend cruising. Full racing inventory plus cruising sails." },
  { make: "Fountaine Pajot", model: "Isla 40", year: 2022, price: 520000, currency: "EUR", location: "Canet-en-Roussillon, France", loa: 39.8, beam: 22, draft: 4, rig: "sloop", hull: "fiberglass", engine: "2x Volvo D1-20 diesel", berths: 8, heads: 3, condition: 9, tags: ["modern", "family-friendly", "liveaboard-ready"], desc: "Nearly new Fountaine Pajot Isla 40 catamaran. Maestro version with spacious owner's suite. Solar panels, lithium batteries, watermaker." },
  { make: "Pacific Seacraft", model: "34", year: 1998, price: 115000, currency: "USD", location: "Ventura, CA", loa: 34, beam: 10.7, draft: 5, rig: "cutter", hull: "fiberglass", engine: "Yanmar 30HP diesel", berths: 4, heads: 1, condition: 7, tags: ["bluewater", "classic", "solo-sailor"], desc: "Pacific Seacraft 34 cutter — the small bluewater classic. Hand-laid fiberglass, full keel, and capable of crossing any ocean. Perfect for single-handers." },
  { make: "Jeanneau", model: "Sun Fast 3300", year: 2021, price: 168000, currency: "EUR", location: "Lorient, France", loa: 33, beam: 11.2, draft: 6.5, rig: "sloop", hull: "fiberglass", engine: "Nanni 21HP diesel", berths: 4, heads: 1, condition: 9, tags: ["race-ready", "modern", "solo-sailor"], desc: "Purpose-built offshore racer. Carbon bowsprit, twin rudders, and IRC-optimized hull. Podium finisher in multiple offshore races." },
  { make: "Irwin", model: "52 CC", year: 1986, price: 89000, currency: "USD", location: "Marathon, FL", loa: 52, beam: 15.5, draft: 5.5, rig: "ketch", hull: "fiberglass", engine: "Perkins 85HP diesel", berths: 8, heads: 2, condition: 5, tags: ["liveaboard-ready", "budget-friendly", "project-boat"], desc: "Massive Irwin 52 center cockpit ketch. Florida Keys liveaboard with a huge interior. Needs engine work and rigging attention but incredible value for the size." },
  { make: "X-Yachts", model: "X43", year: 2014, price: 330000, currency: "EUR", location: "Copenhagen, Denmark", loa: 43, beam: 13.5, draft: 7.2, rig: "sloop", hull: "fiberglass", engine: "Volvo D2-40 diesel", berths: 6, heads: 2, condition: 8, tags: ["race-ready", "modern", "coastal-cruiser"], desc: "Danish-designed X-Yachts X43 — the perfect performance cruiser. Carbon rig option, racing keel, and a luxury interior. Weekend racer, weekday cruiser." },
  { make: "Privilege", model: "435", year: 2006, price: 285000, currency: "EUR", location: "Martinique, Caribbean", loa: 43, beam: 24, draft: 3.8, rig: "sloop", hull: "fiberglass", engine: "2x Volvo 30HP diesel", berths: 8, heads: 3, condition: 6, tags: ["liveaboard-ready", "family-friendly", "classic"], desc: "Allures-designed Privilege 435 catamaran. Built for ocean passages. Large salon, separate navigation station, and excellent upwind performance for a cat." },
  { make: "Valiant", model: "40", year: 1995, price: 135000, currency: "USD", location: "Beaufort, NC", loa: 40, beam: 12, draft: 6, rig: "cutter", hull: "fiberglass", engine: "Yanmar 44HP diesel", berths: 5, heads: 2, condition: 6, tags: ["bluewater", "classic", "solo-sailor"], desc: "Robert Perry-designed Valiant 40 cutter. Legendary offshore yacht with numerous ocean crossings. Canoe stern, solid construction, proven design." },
  { make: "Dehler", model: "38 SQ", year: 2023, price: 310000, currency: "EUR", location: "Kiel, Germany", loa: 38, beam: 12.3, draft: 6.8, rig: "sloop", hull: "fiberglass", engine: "Volvo D1-30 diesel", berths: 6, heads: 1, condition: 10, tags: ["modern", "race-ready", "turnkey"], desc: "Brand new Dehler 38 SQ — German engineering at its finest. Twin rudders, T-keel, and a stunning interior. The sports sedan of the sailing world." },
];

function generateSlug(year: number, make: string, model: string, location: string): string {
  return [year, make, model, location.split(",")[0]]
    .map((p) => String(p).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""))
    .join("-");
}

async function seed() {
  console.log("Seeding 30 sample boats...");

  // Create a system seller user
  let seller = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = 'system@datemyboat.namibarden.com'"
  );
  if (!seller) {
    seller = await queryOne<{ id: string }>(
      `INSERT INTO users (clerk_id, email, display_name, role, subscription_tier)
       VALUES ('system_seller', 'system@datemyboat.namibarden.com', 'DateMyBoat Team', 'seller', 'featured')
       RETURNING id`
    );
  }

  for (const b of BOATS) {
    const slug = generateSlug(b.year, b.make, b.model, b.location);

    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM boats WHERE slug = $1",
      [slug]
    );
    if (existing) {
      console.log(`  [skip] ${slug}`);
      continue;
    }

    const boat = await queryOne<{ id: string }>(
      `INSERT INTO boats (seller_id, slug, make, model, year, asking_price, currency, status, location_text, is_sample)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, true)
       RETURNING id`,
      [seller!.id, slug, b.make, b.model, b.year, b.price, b.currency, b.location]
    );

    if (boat) {
      await query(
        `INSERT INTO boat_dna (boat_id, specs, character_tags, condition_score, ai_summary)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          boat.id,
          JSON.stringify({
            loa: b.loa,
            beam: b.beam,
            draft: b.draft,
            rig_type: b.rig,
            hull_material: b.hull,
            engine: b.engine,
            berths: b.berths,
            heads: b.heads,
          }),
          b.tags,
          b.condition,
          b.desc,
        ]
      );
      console.log(`  [add]  ${slug}`);
    }
  }

  console.log("Seed complete. Run embedding generation separately if OpenAI key is available.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
