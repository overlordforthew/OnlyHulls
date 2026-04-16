import test from "node:test";
import assert from "node:assert/strict";

import { buildBoatFitReasons } from "../../src/lib/boat-fit";

test("buildBoatFitReasons summarizes setup, use case, and comparison path for imported listings", () => {
  const reasons = buildBoatFitReasons({
    locale: "en",
    specs: {
      loa: 40,
      vessel_type: "catamaran",
      rig_type: "sloop",
      cabins: 3,
      heads: 2,
    },
    characterTags: ["liveaboard", "bluewater"],
    locationText: "Bahamas",
    sourceUrl: "https://example.com/listing",
    similarBoatCount: 3,
  });

  assert.deepEqual(reasons, [
    "Quick read on the setup: 40ft LOA, Catamaran, Sloop, with 3 cabins and 2 heads.",
    "The listing signals liveaboard use and offshore passages.",
    "You can benchmark it against 3 similar boats in this market before reaching out.",
  ]);
});

test("buildBoatFitReasons falls back to direct-contact context when market comparison is thin", () => {
  const reasons = buildBoatFitReasons({
    locale: "en",
    specs: {
      cabins: 2,
      berths: 6,
    },
    locationText: null,
    sourceUrl: null,
    similarBoatCount: 0,
  });

  assert.deepEqual(reasons, [
    "The layout includes 2 cabins and 6 berths.",
    "This is a direct OnlyHulls listing, so the conversation can stay inside the marketplace.",
  ]);
});

test("buildBoatFitReasons localizes core buyer guidance for spanish detail pages", () => {
  const reasons = buildBoatFitReasons({
    locale: "es",
    specs: {
      loa: 36,
      vessel_type: "monohull",
    },
    locationText: "Valencia",
    sourceUrl: "https://example.com/listing",
    similarBoatCount: 0,
  });

  assert.deepEqual(reasons, [
    "La base del barco se lee rapido: 36 pies de eslora, Monohull.",
    "La ubicacion en Valencia importa si estas comprando por zona de crucero, puerto de entrega o logistica.",
    "OnlyHulls lo mantiene dentro de tu flujo de comparacion primero y luego te lleva al anuncio original cuando estes listo.",
  ]);
});
