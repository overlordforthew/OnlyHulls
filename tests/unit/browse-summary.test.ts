import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBoatBrowseSummary,
  buildBoatPublicSummary,
  cleanImportedListingSummary,
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
