import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBoatBrowseSummary,
  buildBoatPublicSummary,
  cleanImportedListingSummary,
  compressImportedListingSummary,
  shouldCompressImportedListingSummary,
} from "../../src/lib/browse-summary";

test("buildBoatBrowseSummary drops title, price, and import-source boilerplate", () => {
  assert.equal(
    buildBoatBrowseSummary({
      title: "1988 Stephens Sparkman & Stevens 88",
      locationText: "Bahamas",
      summary:
        "1988 Stephens Sparkman & Stevens 88 listed in Bahamas. Key specs include 88ft LOA, motorsailer rig, monohull hull. Asking USD 695,000. Imported from Sailboat Listings.",
    }),
    "88ft LOA, motorsailer rig, monohull."
  );
});

test("buildBoatBrowseSummary keeps the useful middle sentence from source-style copy", () => {
  assert.equal(
    buildBoatBrowseSummary({
      title: "1974 Contest Yachts 33",
      locationText: "Nassau, Bahamas",
      summary:
        "1974 Contest Yachts 33 in Nassau, Bahamas. Masthead sloop, 33-ft LOA, 10.5 ft beam, 5 ft draft. Asking USD 19,500.",
    }),
    "Masthead sloop, 33-ft LOA, 10.5 ft beam, 5 ft draft."
  );
});

test("buildBoatBrowseSummary trims mixed title, location, and asking boilerplate", () => {
  assert.equal(
    buildBoatBrowseSummary({
      title: "1978 Islander 32 Mk II Shoal Draft",
      locationText: "Georgetown Exuma, Bahamas",
      summary:
        "1978 Islander 32 Mk II Shoal Draft with masthead sloop rig, 32' LOA, 10' beam, and 4' draft. Located in Georgetown Exuma, Bahamas; asking $25,000.",
    }),
    "Masthead sloop rig, 32' LOA, 10' beam, and 4' draft."
  );
});

test("buildBoatBrowseSummary preserves already-useful summaries", () => {
  assert.equal(
    buildBoatBrowseSummary({
      title: "2013 Lagoon 400 S2",
      locationText: "Bahamas",
      summary:
        "Three-cabin owner's layout with updated canvas, solar support, and a practical cruising cockpit setup.",
    }),
    "Three-cabin owner's layout with updated canvas, solar support, and a practical cruising cockpit setup."
  );
});

test("cleanImportedListingSummary keeps enough detail for stored summaries", () => {
  assert.equal(
    cleanImportedListingSummary({
      title: "1988 Stephens Sparkman & Stevens 88",
      locationText: "Bahamas",
      summary:
        "1988 Stephens Sparkman & Stevens 88 listed in Bahamas. Key specs include 88ft LOA, motorsailer rig, monohull hull. Asking USD 695,000. Imported from Sailboat Listings.",
    }),
    "1988 Stephens Sparkman & Stevens 88 in Bahamas. 88ft LOA, motorsailer rig, monohull."
  );
});

test("buildBoatPublicSummary drops title and location boilerplate for public readers", () => {
  assert.equal(
    buildBoatPublicSummary({
      title: "1988 Stephens Sparkman & Stevens 88",
      locationText: "Bahamas",
      summary:
        "1988 Stephens Sparkman & Stevens 88 listed in Bahamas. Key specs include 88ft LOA, motorsailer rig, monohull hull. Asking USD 695,000. Imported from Sailboat Listings.",
    }),
    "88ft LOA, motorsailer rig, monohull."
  );
});

test("cleanImportedListingSummary removes asking-price and broker call-to-action boilerplate", () => {
  assert.equal(
    cleanImportedListingSummary({
      title: "2016 Lagoon 450",
      locationText: "Langkawi",
      summary:
        "This 2016 Lagoon 450 F Owners Version is currently for sale in Langkawi. A proven performer among cruising catamarans with spacious comfort and blue-water capability. Please contact our broker for making an appointment. Asking price USD560,000 or nearest offer! De Valk Multihull is your go-to contact for any questions. Feel free to give us a call.",
    }),
    "This 2016 Lagoon 450 F Owners Version is currently for sale in Langkawi. A proven performer among cruising catamarans with spacious comfort and blue-water capability."
  );
});

test("buildBoatPublicSummary drops price-led sales blurbs from long imported summaries", () => {
  assert.equal(
    buildBoatPublicSummary({
      title: "2023 Beneteau Oceanis 38.1",
      locationText: "Bangor",
      summary:
        "With over 750 built, the Oceanis 38.1 is the perfect family or short handed cruiser. Lying Bangor, near Belfast - Northern Ireland ASKING PRICE JUST REDUCED TO £174,950. 2023 Beneteau Oceanis 38.1 with the two double cabin layout and larger 40hp engine.",
    }),
    "With over 750 built, the Oceanis 38.1 is the perfect family or short handed cruiser. The two double cabin layout and larger 40hp engine."
  );
});

test("cleanImportedListingSummary removes colon-style asking price boilerplate", () => {
  assert.equal(
    cleanImportedListingSummary({
      title: "2024 Sunreef 80 Eco",
      locationText: "Italy",
      summary:
        "Launched at the end of 2024, The Idler is a rare chance to step straight into ownership of a brand-new Sunreef 80 Eco. Antigua Charter Yacht Show - Dec Miami International Yacht Show - Feb Asking Price: €10,450,000 ex VAT. Every element of her design reflects modern luxury with a lighter footprint.",
    }),
    "Launched at the end of 2024, The Idler is a rare chance to step straight into ownership of a brand-new Sunreef 80 Eco. Antigua Charter Yacht Show - Dec Miami International Yacht Show - Feb. Every element of her design reflects modern luxury with a lighter footprint."
  );
});

test("buildBoatPublicSummary strips location-led title duplication even when model punctuation differs", () => {
  assert.equal(
    buildBoatPublicSummary({
      title: "2023 Beneteau Oceanis 38 1",
      locationText: "Bangor, Down",
      summary:
        "With over 750 built, the Oceanis 38.1 is the perfect family/short handed cruiser. Lying Bangor, near Belfast - Northern Ireland 2023 Beneteau Oceanis 38.1 with the two double cabin layout and larger 40hp engine.",
    }),
    "With over 750 built, the Oceanis 38.1 is the perfect family/short handed cruiser. The two double cabin layout and larger 40hp engine."
  );
});

test("buildBoatPublicSummary repairs live location-plus-model artifacts left by earlier cleanup", () => {
  assert.equal(
    buildBoatPublicSummary({
      title: "2023 Beneteau Oceanis 38 1",
      locationText: "Bangor, Down",
      summary:
        "With over 750 built, the Oceanis 38.1 is the perfect family/short handed cruiser. Lying Bangor, near Belfast - Northern Ireland1 with the two double cabin layout and larger 40hp engine.",
    }),
    "With over 750 built, the Oceanis 38.1 is the perfect family/short handed cruiser. The two double cabin layout and larger 40hp engine."
  );
});

test("buildBoatPublicSummary repairs stray punctuation and filler tails in live imported summaries", () => {
  assert.equal(
    buildBoatPublicSummary({
      title: "2023 Beneteau Oceanis 38 1",
      locationText: "Bangor, Down",
      summary:
        "With over 750 built, the Oceanis 38.1 is the perfect family/short handed cruiser. This model comes with a great spec to include the 2 cabin layout with separate shower and head,. L-shaped galley and larger 40hp engine, Mainsail arch and sprayhood with cockpit enclosure, electric halyard winch and windlass, Iroko wood cockpit and so much more.",
    }),
    "With over 750 built, the Oceanis 38.1 is the perfect family/short handed cruiser. This model comes with a great spec to include the 2 cabin layout with separate shower and head. L-shaped galley and larger 40hp engine, Mainsail arch and sprayhood with cockpit enclosure, electric halyard winch and windlass, Iroko wood cockpit."
  );
});

test("cleanImportedListingSummary removes platform boilerplate after useful source copy", () => {
  assert.equal(
    cleanImportedListingSummary({
      title: "2016 Lagoon 450",
      locationText: "Langkawi",
      summary:
        "This 2016 Lagoon 450 F Owners Version is currently for sale in Langkawi. A proven performer among cruising catamarans with spacious comfort and blue-water capability. We provide only a selection of key information on this platform.",
    }),
    "This 2016 Lagoon 450 F Owners Version is currently for sale in Langkawi. A proven performer among cruising catamarans with spacious comfort and blue-water capability."
  );
});

test("shouldCompressImportedListingSummary flags long imported broker writeups", () => {
  assert.equal(
    shouldCompressImportedListingSummary({
      summary:
        "This 2016 Lagoon 450 F Owners Version is currently for sale in Langkawi. A proven performer among cruising catamarans, the 450 F offers spacious comfort, elegant design, and outstanding blue-water capability. Lovingly maintained by a meticulous owner and used primarily for family cruising and benefits from continuous care and significant upgrades over the past years. She has many features like full aircon, solar panels, watermaker, all-new deck and cockpit cushions, new trampolines and many more.",
    }),
    true
  );
});

test("compressImportedListingSummary keeps the strongest factual sentences under budget", () => {
  assert.equal(
    compressImportedListingSummary({
      summary:
        "This 2016 Lagoon 450 F Owners Version is currently for sale in Langkawi. A proven performer among cruising catamarans, the 450 F offers spacious comfort, elegant design, and outstanding blue-water capability. Lovingly maintained by a meticulous owner and used primarily for family cruising and benefits from continuous care and significant upgrades over the past years. She has many features like full aircon, solar panels, watermaker, all-new deck and cockpit cushions, new trampolines and many more.",
      maxLength: 260,
      maxSentences: 2,
    }),
    "This 2016 Lagoon 450 F Owners Version is currently for sale in Langkawi. A proven performer among cruising catamarans, the 450 F offers spacious comfort, elegant design, and outstanding blue-water capability."
  );
});

test("compressImportedListingSummary splits structured spec sheets without ai", () => {
  assert.equal(
    compressImportedListingSummary({
      summary:
        "TYPE: BENETEAU OCEANIS 430 owner’s version DISPLACEMENT: 9000kg (ballast 3600kg) WC/SHOWER: 2/2 + Cockpit shower ENGINE TYPE: Perkins Prima M50 POWER TRANSMISSION: Shaft/ 3 blades fixed propeller (Bronze) with small rope cutter • 2 solar panels 2×135 W (peak) • 2 Victron charge controllers MPPT 100/20 • 2 solar panels 15 Wpeak from Solara accessible on deck.",
      maxLength: 260,
      maxSentences: 3,
    }),
    "TYPE: BENETEAU OCEANIS 430 owner’s version. DISPLACEMENT: 9000kg (ballast 3600kg). WC/SHOWER: 2/2 + Cockpit shower."
  );
});

test("cleanImportedListingSummary removes leading contact boilerplate from dense imported copy", () => {
  assert.equal(
    cleanImportedListingSummary({
      summary:
        "FOR INFORMATION CLAUDIO BACCHELLI +39 3356507516 Owner's cabin in the bow with dedicated bathroom Double cabin aft with dedicated bathroom C-shaped kitchen equipped with sink, fridge, oven and burner 2023) Diesel tank cleaning - mounted chain counter 2022) 2 electric toilets fitted - boiler heating element replaced 2021) replaced 5 service batteries (Varta).",
    }),
    "Owner's cabin in the bow with dedicated bathroom. Double cabin aft with dedicated bathroom. C-shaped kitchen equipped with sink, fridge, oven and burner. 2023) Diesel tank cleaning - mounted chain counter. 2022) 2 electric toilets fitted - boiler heating element replaced. 2021) replaced 5 service batteries (Varta)."
  );
});

test("buildBoatBrowseSummary strips TheYachtMarket remarks boilerplate without ai", () => {
  assert.equal(
    buildBoatBrowseSummary({
      title: "1980 Rival 41 AC",
      locationText: "Cardiff",
      sourceSite: "theyachtmarket",
      summary:
        "Remarks :PART EXCHANGE & FINANCE AVAILABLE REMARKS Border Rival is a Rival 41 Aft Cockpit with just three owners since new, known for her solid construction, sea-kindly design, and reputation as a true blue-water yacht. She comes with a full history of receipts and a detailed maintenance spreadsheet. She is handsome, immensely capable, and clearly cherished.",
    }),
    "Border Rival is a Rival 41 Aft Cockpit with just three owners since new, known for her solid construction, sea-kindly design, and reputation as a true blue-water yacht."
  );
});

test("buildBoatPublicSummary segments TheYachtMarket run-on spec blocks", () => {
  assert.equal(
    buildBoatPublicSummary({
      title: "1974 Bowman 36",
      locationText: "Gosport",
      sourceSite: "theyachtmarket",
      summary:
        "Bowman 36 Proven Offshore Cruiser with Extensive Upgrades GRP hull construction Long keel configuration for offshore capability Teak interior joinery fitted to a high specification Seven coats Gelshield applied to hull in 1996 Topsides painted with International Perfection two-pack system in 2012 Deck repainted with the same system in 2015 Bronze anodised spars.",
    }),
    "Proven Offshore Cruiser with Extensive Upgrades. Long keel configuration for offshore capability. Teak interior joinery fitted to a high specification."
  );
});

test("buildBoatPublicSummary does not over-split already-readable TheYachtMarket prose", () => {
  assert.equal(
    buildBoatPublicSummary({
      title: "1972 Fisher 30",
      locationText: "Ramsgate",
      sourceSite: "theyachtmarket",
      summary:
        "Recently refurbished with new stainless steel rigging and a Digital Raymarine radar and navigation system, this Fisher 30 Motorsailer is a robust, safe and reliable all weather boat. It is at home in both calm inland waters and the roughest of sea conditions, born from its design origins of a Norwegian fishing boat. • Ketch rigged, with Kemp masts and spars.",
    }),
    "Recently refurbished with new stainless steel rigging and a Digital Raymarine radar and navigation system, this Fisher 30 Motorsailer is a robust, safe and reliable all weather boat. It is at home in both calm inland waters and the roughest of sea conditions, born from its design origins of a Norwegian fishing boat. Ketch rigged, with Kemp masts and spars."
  );
});

test("cleanImportedListingSummary repairs old dotted artifact fragments from earlier cleanup", () => {
  assert.equal(
    cleanImportedListingSummary({
      sourceSite: "theyachtmarket",
      summary:
        "One. Forward cabin with two bunks One. Forward shower room with manual toilet and washbasin Galley on the port side with central cabinet Chart table on the starboard side Hot and cold pressurized water.",
    }),
    "One forward cabin with two bunks. One forward shower room with manual toilet and washbasin. Galley on the port side with central cabinet. Chart table on the starboard side. Hot and cold pressurized water."
  );
});

test("cleanImportedListingSummary repairs lingering with-dot number artifacts", () => {
  assert.equal(
    cleanImportedListingSummary({
      sourceSite: "theyachtmarket",
      summary:
        "A compact twin keel yacht with. Four berths, Beta diesel and cruising kit to include stack pack main. Easily sailed single handed or by a couple.",
    }),
    "A compact twin keel yacht with four berths, Beta diesel and cruising kit to include stack pack main. Easily sailed single handed or by a couple."
  );
});
