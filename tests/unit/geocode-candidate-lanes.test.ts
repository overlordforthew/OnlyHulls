import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getPublicPinApplyGateStop,
  getPublicPinApplyResult,
  getPublicPinEligibleRate,
  isPublicPinLikelyGeocodeCandidate,
  isPublicPinEligiblePrecision,
  isPublicPinEligibleResult,
  isPublicPinLikelyText,
  isVerifiedPublicPinAliasGeocodeCandidate,
} from "../../src/lib/locations/geocode-candidate-lanes";
import {
  VERIFIED_PUBLIC_PIN_LOCATION_ALIAS_DEFINITIONS,
  getVerifiedPublicPinAliasMatch,
  isVerifiedPublicPinAliasAnchorMatch,
} from "../../src/lib/locations/verified-public-pin-aliases";
import {
  buildGeocodeQuery,
  type GeocodeResult,
} from "../../src/lib/locations/geocoding";

test("public pin candidate lane accepts marine-specific location text", () => {
  const accepted = [
    "Jolly Harbour Marina, Antigua",
    "Alimos Marina, Athens, Greece",
    "British Virgin Islands, Hodge's Creek Marina, Caribbean",
    "Yacht Marine Marina Marmaris, Turkey",
    "D-Marin Lefkas Marina, Lefkada, Greece",
    "Marmaris Yacht Marina, Turkey",
    "Marina du Marin, Martinique",
    "Port Pin Rolland, Saint-Mandrier-sur-Mer, France",
    "Port Tino Rossi, Ajaccio, France",
    "Puerto del Rey Marina, Puerto Rico",
    "Darsena di Marina, Italy",
    "Port de Plaisance, Saint Martin",
    "Queensway Quay Marina",
    "Shelter Bay Boatyard",
    "Sag Harbor Yacht Club",
    "Rhodes Shipyard, Greece",
  ];

  for (const value of accepted) {
    assert.equal(isPublicPinLikelyText(value), true, value);
  }
});

test("public pin candidate lane rejects broad city and region-only text", () => {
  const rejected = [
    "Palma De Mallorca, Spain",
    "Athens, Greece",
    "Cartagena, Murcia, Spain",
    "Alicante, Valencian Community",
    "Lefkas, Greece",
    "Punta Gorda, Florida",
    "Canary Islands, Spain",
    "Mediterranean",
    "Luperon Harbour Mooring",
    "Puerto Rico, USA",
    "Porto Cervo, Sardinia",
    "Marmaris Yacht Marine",
    "Port de Marseille, France",
    "Suffolk Yacht Harbour",
    "Suffolk Yacht Harbour Ip10 0ln",
    "Buckler's Hard Yacht Harbour, Beaulieu, Hampshire So42 7xb",
    "Generic Yacht Harbour",
  ];

  for (const value of rejected) {
    assert.equal(isPublicPinLikelyText(value), false, value);
  }
});

test("public pin candidate lane accepts reviewed public-pin aliases", () => {
  const accepted = [
    "Burnham Yacht Harbour",
    "burnham yacht harbour, United Kingdom",
    "Burnham-Yacht-Harbour",
    "Conwy Marina",
    "Palm Cay Marina, Nassau, Bahamas",
    "Medway Yacht Club Pontoon",
    "Marina Baotic, Seget Donji, Croatia",
    "Linton Bay Marina, Panama",
    "MDL Chatham Maritime Marina Boatyard",
  ];

  for (const value of accepted) {
    assert.equal(isPublicPinLikelyText(value), true, value);
  }
});

test("verified public pin alias lane stays narrower than broad marina text", () => {
  const accepted = [
    "Burnham Yacht Harbour, United Kingdom",
    "Conwy Marina Village, LL32 8GU",
    "Chichester Marina, Appledram",
    "Palm Cay Marina, Nassau",
    "Medway Yacht Club Pontoon",
    "Lagoon Marina, Cole Bay",
    "Marina Frapa, Rogoznica",
    "Marina Baotić, Seget Donji",
    "Linton Bay Marina, Puerto Lindo",
    "MDL Chatham Maritime Marina Boatyard, Chatham",
    // Round 23: Green Cay Marina is now a verified alias; the actual
    // promotion gate still depends on provider anchor (country, coords,
    // marina component, score). The lane-candidate predicate just checks
    // that the alias text is present in both source and query — which is
    // true for the three observed production source texts and for the
    // canonical query they canonicalize to.
    "Green Cay Marina St. Croix",
  ];
  const rejected = [
    "Dover Marina, Kent",
    "Tollesbury Marina",
    "Shotley Marina, IP9 1QJ",
    "Port Solent Marina, Portsmouth",
    "Marina Del Rey, California",
    "Chatham Maritime Marina Boatyard",
    "Baotic Marina, Trogir",
    "Linton",
    "Linton Bay",
    "Bay Marina, Panama",
    "Generic Marina",
  ];

  for (const value of accepted) {
    assert.equal(
      isVerifiedPublicPinAliasGeocodeCandidate({ locationText: value, queryText: value }),
      true,
      value
    );
  }

  for (const value of rejected) {
    assert.equal(
      isVerifiedPublicPinAliasGeocodeCandidate({ locationText: value, queryText: value }),
      false,
      value
    );
  }

  assert.equal(
    isVerifiedPublicPinAliasGeocodeCandidate({
      locationText: "Conwy Marina",
      queryText: "Conwy, United Kingdom",
    }),
    false,
    "alias retries must stay anchored to the geocode query"
  );
});

test("verified public pin aliases require the same alias in query and result", () => {
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "Conwy Marina, United Kingdom",
      "Conwy Marina, Conwy Marina Village, LL32 8GU, United Kingdom"
    ),
    "conwy marina"
  );
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "CONWY MARINA.",
      "Conwy Marina, Conwy Marina Village, LL32 8GU, United Kingdom."
    ),
    "conwy marina"
  );
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "Chatham Marina, Kent, United Kingdom",
      "MDL Chatham Maritime Marina Boatyard, Chatham, Medway, England, United Kingdom"
    ),
    null
  );
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "MDL Chatham Maritime Marina Boatyard, Chatham, United Kingdom",
      "MDL Chatham Maritime Marina Boatyard, Chatham, Medway, England, United Kingdom"
    ),
    "mdl chatham maritime marina boatyard"
  );
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "Marina Del Rey, California, United States",
      "Los Angeles County, CA 90292, United States of America"
    ),
    null
  );
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "Marina Baotic, Seget Donji, Croatia",
      "Marina Baotić, Ulica don Petra Špika 2A, 21218 Seget Donji, Croatia"
    ),
    "marina baotic"
  );
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "Linton Bay Marina",
      "Linton Bay Marina, Carretera Portobelo - La Guaira, Puerto Lindo, Colón, Panama"
    ),
    "linton bay marina"
  );
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "Linton Bay",
      "Linton Bay Marina, Carretera Portobelo - La Guaira, Puerto Lindo, Colón, Panama"
    ),
    null
  );
});

test("verified Chatham alias requires the anchored boatyard component", () => {
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("mdl chatham maritime marina boatyard", {
      countryCode: "gb",
      latitude: 51.4025553,
      longitude: 0.5321595,
      score: 1,
      payload: {
        components: {
          _type: "boatyard",
          boatyard: "MDL Chatham Maritime Marina Boatyard",
        },
      },
    }),
    true
  );

  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("mdl chatham maritime marina boatyard", {
      countryCode: "gb",
      latitude: 51.4024964,
      longitude: 0.5406148,
      score: 0.92,
      payload: {
        components: {
          _type: "water",
          water: "Chatham Maritime Marina",
        },
      },
    }),
    false
  );

  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("mdl chatham maritime marina boatyard", {
      countryCode: "us",
      latitude: 51.4025553,
      longitude: 0.5321595,
      score: 1,
      payload: {
        components: {
          _type: "boatyard",
          boatyard: "MDL Chatham Maritime Marina Boatyard",
        },
      },
    }),
    false
  );
});

test("verified public pin alias anchors preserve Sint Maarten provider country-code nuance", () => {
  for (const countryCode of ["nl", "sx"]) {
    assert.equal(
      isVerifiedPublicPinAliasAnchorMatch("lagoon marina", {
        countryCode,
        latitude: 18.0333598,
        longitude: -63.0857087,
      }),
      true,
      countryCode
    );
  }

  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("lagoon marina", {
      countryCode: "fr",
      latitude: 18.0333598,
      longitude: -63.0857087,
    }),
    false
  );
});

test("verified Green Cay Marina alias requires the anchored marina component", () => {
  // Positive: exact facility evidence.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("green cay marina", {
      countryCode: "us",
      latitude: 17.7591487,
      longitude: -64.6694756,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "Green Cay Marina",
          country_code: "us",
        },
      },
    }),
    true
  );

  // Defensive VI country-code acceptance (provider currently returns `us` but
  // some call sites may pass ISO alpha-2 `vi` — both must be accepted).
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("green cay marina", {
      countryCode: "vi",
      latitude: 17.7591487,
      longitude: -64.6694756,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "Green Cay Marina",
          country_code: "us",
        },
      },
    }),
    true
  );

  // Wrong country rejection: Bahamian Green Cay must not promote.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("green cay marina", {
      countryCode: "bs",
      latitude: 17.7591487,
      longitude: -64.6694756,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "Green Cay Marina",
          country_code: "bs",
        },
      },
    }),
    false
  );

  // `_type=water` at the right coords must NOT promote — no marina component.
  // (Documents the Lonvilliers-Harbour-style rejection policy.)
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("green cay marina", {
      countryCode: "us",
      latitude: 17.7591487,
      longitude: -64.6694756,
      score: 1,
      payload: {
        components: {
          _type: "water",
          water: "Green Cay Marina",
          country_code: "us",
        },
      },
    }),
    false
  );

  // Missing marina component entirely — even if coords/country correct.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("green cay marina", {
      countryCode: "us",
      latitude: 17.7591487,
      longitude: -64.6694756,
      score: 1,
      payload: { components: { country_code: "us" } },
    }),
    false
  );

  // Score just below minScore 0.95 fails; at boundary passes.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("green cay marina", {
      countryCode: "us",
      latitude: 17.7591487,
      longitude: -64.6694756,
      score: 0.94,
      payload: {
        components: { _type: "marina", marina: "Green Cay Marina", country_code: "us" },
      },
    }),
    false
  );
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("green cay marina", {
      countryCode: "us",
      latitude: 17.7591487,
      longitude: -64.6694756,
      score: 0.95,
      payload: {
        components: { _type: "marina", marina: "Green Cay Marina", country_code: "us" },
      },
    }),
    true
  );

  // Distance just outside 0.5 km fails. 0.5 km at latitude ~17.76 is ~0.0045 degrees.
  // 0.6 km east of the anchor → lng offset ~0.0057 → well outside the 0.5km ring.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("green cay marina", {
      countryCode: "us",
      latitude: 17.7591487,
      longitude: -64.6694756 + 0.0057,
      score: 1,
      payload: {
        components: { _type: "marina", marina: "Green Cay Marina", country_code: "us" },
      },
    }),
    false
  );
});

test("getVerifiedPublicPinAliasMatch recognizes green cay marina across source/result variants", () => {
  // Canonical query + facility result.
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "Green Cay Marina, Christiansted, US Virgin Islands",
      "Green Cay Marina, 5000 Southgate Estate, Shoys, Christiansted, VI 00820, United States of America"
    ),
    "green cay marina"
  );

  // Dirty production source text also matches (alias regex tolerant).
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "Green Cay Marina St. Croix",
      "Green Cay Marina, 5000 Southgate Estate, Shoys, Christiansted, VI 00820, United States of America"
    ),
    "green cay marina"
  );

  // Missing "Green" token → alias regex rejects.
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "Cay Marina, St. Croix",
      "Green Cay Marina, Christiansted, VI 00820, United States of America"
    ),
    null
  );

  // Missing "Marina" token → alias regex rejects.
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "Green Cay, Bahamas",
      "Green Cay, Bahamas"
    ),
    null
  );

  // Alias in query but provider result lacks it (city-only) → alias match returns null,
  // because the match requires the alias phrase in BOTH sides.
  assert.equal(
    getVerifiedPublicPinAliasMatch(
      "Green Cay Marina, St Croix",
      "St Croix, Virgin Islands, United States of America"
    ),
    null
  );
});

test("round 23 Green Cay canonicalization maps accepted source texts to canonical query", () => {
  // Positive: three observed production source texts all canonicalize.
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Green Cay Marina St. Croix",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Green Cay Marina, Christiansted, US Virgin Islands",
      queryKey: "green cay marina christiansted us virgin islands",
      countryHint: "vi",
      providerCountryCodes: ["us", "vi"],
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Green Cay Marina, St Croix, Virgin Islands (US) (USVI)",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Green Cay Marina, Christiansted, US Virgin Islands",
      queryKey: "green cay marina christiansted us virgin islands",
      countryHint: "vi",
      providerCountryCodes: ["us", "vi"],
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Green Cay Marina, Virgin Islands (US) (USVI)",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Green Cay Marina, Christiansted, US Virgin Islands",
      queryKey: "green cay marina christiansted us virgin islands",
      countryHint: "vi",
      providerCountryCodes: ["us", "vi"],
    }
  );

  // Near-miss: BVI suffix must NOT canonicalize to the USVI canonical.
  const bvi = buildGeocodeQuery({
    locationText: "Green Cay Marina, St Croix, BVI",
    country: "British Virgin Islands",
    confidence: "city",
  });
  assert.notDeepStrictEqual(bvi?.queryText, "Green Cay Marina, Christiansted, US Virgin Islands");

  // Bare source text passes through unchanged (no canonicalization). Because
  // "green cay marina" is a verified alias, buildGeocodeQuery emits the raw
  // text as a query even at confidence=unknown; safety is enforced at the
  // provider-result anchor stage (country/coords/component), not here.
  // providerCountryCodes=["us","vi"] is still populated because the alias
  // text appears in the query, so OpenCage gets a `us,vi` filter that
  // surfaces the marina rather than under-ranking it behind Christiansted.
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Green Cay Marina",
      country: null,
      confidence: "unknown",
    }),
    {
      queryText: "Green Cay Marina",
      queryKey: "green cay marina",
      countryHint: null,
      providerCountryCodes: ["us", "vi"],
    }
  );
});

test("alias acceptedSourceTexts canonicalize EXACTLY to canonicalProviderQuery (contract)", () => {
  // Country hints used for canonicalization tests, derived from each alias's countryCodes.
  const countryHintLabels: Record<string, string[]> = {
    gb: ["United Kingdom"],
    us: ["United States", "United States Virgin Islands"],
    vi: ["United States Virgin Islands", "US Virgin Islands"],
    hr: ["Croatia"],
    pa: ["Panama"],
    bs: ["Bahamas"],
    nl: ["Netherlands"],
    sx: ["Sint Maarten"],
    ca: ["Canada"],
  };

  for (const def of VERIFIED_PUBLIC_PIN_LOCATION_ALIAS_DEFINITIONS) {
    const accepted = (def as { acceptedSourceTexts?: readonly string[] }).acceptedSourceTexts;
    const canonical = (def as { canonicalProviderQuery?: string }).canonicalProviderQuery;
    const negatives = (def as { negativeSourceTexts?: readonly string[] }).negativeSourceTexts;

    if (!accepted && !negatives) continue;
    assert.ok(
      canonical,
      `alias ${def.alias} declares acceptedSourceTexts or negativeSourceTexts but has no canonicalProviderQuery`
    );

    // Pick any country hint that maps to one of the alias's countryCodes; fall
    // back to empty so we still exercise the cleanup behavior even if the hint
    // map is missing a code.
    const hintCandidates = def.countryCodes.flatMap((code) => countryHintLabels[code] || []);
    const countryHint = hintCandidates[0] || "";

    for (const src of accepted || []) {
      const query = buildGeocodeQuery({
        locationText: src,
        country: countryHint,
        confidence: "city",
      });
      assert.ok(
        query,
        `alias ${def.alias}: source text "${src}" produced no geocode query (country hint "${countryHint}"). ` +
          `Either the cleanup rule is missing or the source text should not be in acceptedSourceTexts.`
      );
      assert.equal(
        query.queryText,
        canonical,
        `alias ${def.alias}: source text "${src}" produced "${query.queryText}" but expected "${canonical}". ` +
          `Add the matching rule to normalizeKnownLocationTextArtifacts or remove the entry from acceptedSourceTexts.`
      );
    }

    // Also verify canonicalization works with every country-hint variant for the alias,
    // catching drift where a specific country context inadvertently bypasses the cleanup.
    for (const src of accepted || []) {
      for (const countryCode of def.countryCodes) {
        for (const label of countryHintLabels[countryCode] || []) {
          const query = buildGeocodeQuery({
            locationText: src,
            country: label,
            confidence: "city",
          });
          assert.ok(query, `alias ${def.alias}: source "${src}" with country "${label}" produced null query`);
          assert.equal(
            query.queryText,
            canonical,
            `alias ${def.alias}: source "${src}" with country "${label}" produced "${query.queryText}" != canonical`
          );
        }
      }
    }

    for (const neg of negatives || []) {
      const query = buildGeocodeQuery({
        locationText: neg,
        country: countryHint,
        confidence: "city",
      });
      if (query) {
        assert.notEqual(
          query.queryText,
          canonical,
          `alias ${def.alias}: negative source text "${neg}" incorrectly canonicalized to "${canonical}"`
        );
      }
      // null queries (e.g. because confidence=unknown or text can't produce a query) are fine.
    }
  }
});

test("verified Toronto Island Marina alias requires the anchored marina component", () => {
  // Positive: Canadian marina facility at anchor coords.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("toronto island marina", {
      countryCode: "ca",
      latitude: 43.6232049,
      longitude: -79.3822702,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "Toronto Island Marina",
          country_code: "ca",
        },
      },
    }),
    true
  );

  // Wrong country: US result at (spurious) anchor coords must fail the country check.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("toronto island marina", {
      countryCode: "us",
      latitude: 43.6232049,
      longitude: -79.3822702,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "Toronto Island Marina",
          country_code: "us",
        },
      },
    }),
    false
  );

  // Missing marina component (e.g. road-type result at matching coords) must fail.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("toronto island marina", {
      countryCode: "ca",
      latitude: 43.6232049,
      longitude: -79.3822702,
      score: 1,
      payload: { components: { _type: "road", road: "Toronto Island Road", country_code: "ca" } },
    }),
    false
  );

  // Score boundary: 0.9 passes, 0.89 fails.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("toronto island marina", {
      countryCode: "ca",
      latitude: 43.6232049,
      longitude: -79.3822702,
      score: 0.9,
      payload: {
        components: { _type: "marina", marina: "Toronto Island Marina", country_code: "ca" },
      },
    }),
    true
  );
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("toronto island marina", {
      countryCode: "ca",
      latitude: 43.6232049,
      longitude: -79.3822702,
      score: 0.89,
      payload: {
        components: { _type: "marina", marina: "Toronto Island Marina", country_code: "ca" },
      },
    }),
    false
  );

  // Distance boundary: ~0.6 km east of anchor at lat 43.62 (longitude offset ~0.0075
  // degrees) is well outside the 0.5km ring.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("toronto island marina", {
      countryCode: "ca",
      latitude: 43.6232049,
      longitude: -79.3822702 + 0.0075,
      score: 1,
      payload: {
        components: { _type: "marina", marina: "Toronto Island Marina", country_code: "ca" },
      },
    }),
    false
  );
});

test("round 24 Toronto Island Marina canonicalizes bare text and preserves qualified variants", () => {
  // Positive: bare source text canonicalizes to the facility query.
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Toronto Island Marina",
      country: null,
      confidence: "unknown",
    }),
    {
      queryText: "Toronto Island Marina, Toronto, Ontario, Canada",
      queryKey: "toronto island marina toronto ontario canada",
      countryHint: "ca",
    }
  );

  // Near-miss negative: a wrong-country suffix must NOT canonicalize to the Canadian
  // canonical query. The anchored `^...$` cleanup rule only matches the exact bare text.
  const usVariant = buildGeocodeQuery({
    locationText: "Toronto Island Marina, USA",
    country: "United States",
    confidence: "city",
  });
  assert.ok(usVariant);
  assert.notEqual(usVariant.queryText, "Toronto Island Marina, Toronto, Ontario, Canada");

  // Qualified but still Canadian variant is safe: canonicalization skips it, but the
  // alias anchor handles the subsequent provider response on its own.
  const ontarioVariant = buildGeocodeQuery({
    locationText: "Toronto Island Marina, Ontario",
    country: "Canada",
    confidence: "city",
  });
  assert.ok(ontarioVariant);
  assert.notEqual(
    ontarioVariant.queryText,
    "Toronto Island Marina, Toronto, Ontario, Canada",
    "qualified `Toronto Island Marina, Ontario` should pass through unchanged; alias anchor still catches the promotion"
  );
  assert.equal(ontarioVariant.countryHint, "ca");
});

test("verified Alcaidesa Marina alias accepts es+gi country codes with marina component", () => {
  // Positive: Spain-tagged facility.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("alcaidesa marina", {
      countryCode: "es",
      latitude: 36.1585704,
      longitude: -5.357562,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "Alcaidesa Marina",
          country_code: "es",
        },
      },
    }),
    true
  );

  // Gibraltar-tagged variant also accepted (defensive; provider currently returns `es`).
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("alcaidesa marina", {
      countryCode: "gi",
      latitude: 36.1585704,
      longitude: -5.357562,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "Alcaidesa Marina",
          country_code: "es",
        },
      },
    }),
    true
  );

  // Wrong country rejection.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("alcaidesa marina", {
      countryCode: "us",
      latitude: 36.1585704,
      longitude: -5.357562,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "Alcaidesa Marina",
          country_code: "us",
        },
      },
    }),
    false
  );

  // Missing marina component — e.g. a Gibraltar city result — must not promote.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("alcaidesa marina", {
      countryCode: "gi",
      latitude: 36.1585704,
      longitude: -5.357562,
      score: 1,
      payload: { components: { _type: "city", country_code: "gi" } },
    }),
    false
  );
});

test("verified D-Marin Didim Marina alias requires the exact marina component", () => {
  // Positive.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("d marin didim marina", {
      countryCode: "tr",
      latitude: 37.3389407,
      longitude: 27.2619989,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "D-Marin Didim Marina",
          country_code: "tr",
        },
      },
    }),
    true
  );

  // Wrong marina name (other D-Marin facility e.g. D-Marin Lefkas) — required value
  // mismatch rejects even with correct country + type.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("d marin didim marina", {
      countryCode: "tr",
      latitude: 37.3389407,
      longitude: 27.2619989,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "D-Marin Lefkas",
          country_code: "tr",
        },
      },
    }),
    false
  );

  // Heliport result (the bare `Didim Marina` query returns `_type=aeroway`); must not
  // promote because `_type` is not `marina`.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("d marin didim marina", {
      countryCode: "tr",
      latitude: 37.3396333,
      longitude: 27.2590445,
      score: 1,
      payload: {
        components: {
          _type: "aeroway",
          aeroway: "D-Marin Didim Marina Heliport",
          country_code: "tr",
        },
      },
    }),
    false
  );
});

test("round 25 Alcaidesa and Didim canonicalizations map only the documented source texts", () => {
  // Positive: Alcaidesa exact source text canonicalizes. Note that the canonicalized
  // queryText names Spain in the address; `countryHint` is derived from the query text
  // signal (es) rather than the original row country (gi). The providerCountryCodes
  // widening still covers both so OpenCage doesn't drop the facility regardless of how
  // the stored country was tagged.
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Alcaidesa Marina In Spain Near Gibraltar",
      country: "Gibraltar",
      confidence: "city",
    }),
    {
      queryText: "Alcaidesa Marina, La Línea de la Concepción, Spain",
      queryKey: "alcaidesa marina la linea de la concepcion spain",
      countryHint: "es",
      providerCountryCodes: ["es", "gi"],
    }
  );

  // Positive: Didim Marina, Turkey canonicalizes to D-Marin facility query.
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Didim Marina, Turkey",
      country: "Turkey",
      confidence: "city",
    }),
    {
      queryText: "D-Marin Didim Marina, Didim, Turkey",
      queryKey: "d marin didim marina didim turkey",
      countryHint: "tr",
    }
  );

  // Negative: plain `Didim, Turkey` (no marina token) must NOT canonicalize to the
  // D-Marin facility query.
  const didimCity = buildGeocodeQuery({
    locationText: "Didim, Turkey",
    country: "Turkey",
    confidence: "city",
  });
  assert.ok(didimCity);
  assert.notEqual(didimCity.queryText, "D-Marin Didim Marina, Didim, Turkey");

  // Negative: `Didim Harbour, Turkey` (harbour, not marina) does NOT canonicalize.
  const didimHarbour = buildGeocodeQuery({
    locationText: "Didim Harbour, Turkey",
    country: "Turkey",
    confidence: "city",
  });
  assert.ok(didimHarbour);
  assert.notEqual(didimHarbour.queryText, "D-Marin Didim Marina, Didim, Turkey");
});

test("cached geocode promotion rejects wrong-country aliased results (Green Cay BVI, Toronto US)", () => {
  // Follow-up from Round 23 consensus gate #2: a hypothetical "Green Cay Marina" result
  // tagged as a BVI/UK territory (country_code=vg) must NOT promote the verified alias
  // even if the coords happen to match the USVI anchor.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("green cay marina", {
      countryCode: "vg",
      latitude: 17.7591487,
      longitude: -64.6694756,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "Green Cay Marina",
          country_code: "vg",
        },
      },
    }),
    false
  );

  // Same pattern for Toronto Island Marina: a US-tagged near-duplicate result must not
  // promote via the Canadian anchor even with otherwise matching fields.
  assert.equal(
    isVerifiedPublicPinAliasAnchorMatch("toronto island marina", {
      countryCode: "us",
      latitude: 43.6232049,
      longitude: -79.3822702,
      score: 1,
      payload: {
        components: {
          _type: "marina",
          marina: "Toronto Island Marina",
          country_code: "us",
        },
      },
    }),
    false
  );
});

test("verified alias country-filter widening stays narrow to multi-country aliases", () => {
  // Single-country alias (burnham yacht harbour → gb only): no widening needed;
  // providerCountryCodes should be absent so the single countryHint is used.
  const burnham = buildGeocodeQuery({
    locationText: "Burnham Yacht Harbour",
    country: "United Kingdom",
    confidence: "city",
  });
  assert.ok(burnham);
  assert.equal(burnham.countryHint, "gb");
  assert.equal(
    (burnham as { providerCountryCodes?: unknown }).providerCountryCodes,
    undefined,
    "single-code alias must not populate providerCountryCodes"
  );

  // MDL Chatham (gb only) via canonicalized source text: still no widening.
  const chatham = buildGeocodeQuery({
    locationText: "Chatham Marina, Kent",
    country: "United Kingdom",
    confidence: "city",
  });
  assert.ok(chatham);
  assert.equal(chatham.countryHint, "gb");
  assert.equal(
    (chatham as { providerCountryCodes?: unknown }).providerCountryCodes,
    undefined,
    "single-code alias must not populate providerCountryCodes"
  );

  // Non-alias ordinary query (no public-pin alias in text): no widening.
  const athens = buildGeocodeQuery({
    locationText: "Athens, Greece",
    country: "Greece",
    confidence: "city",
  });
  assert.ok(athens);
  assert.equal(athens.countryHint, "gr");
  assert.equal(
    (athens as { providerCountryCodes?: unknown }).providerCountryCodes,
    undefined,
    "non-alias queries must not populate providerCountryCodes"
  );

  // Multi-country alias (green cay marina → us+vi): field IS populated.
  const greenCay = buildGeocodeQuery({
    locationText: "Green Cay Marina St. Croix",
    country: "United States Virgin Islands",
    confidence: "city",
  });
  assert.ok(greenCay);
  assert.deepEqual((greenCay as { providerCountryCodes?: readonly string[] }).providerCountryCodes, [
    "us",
    "vi",
  ]);

  // Multi-country alias (lagoon marina → nl+sx): field IS populated.
  const lagoon = buildGeocodeQuery({
    locationText: "Lagoon Marina, Cole Bay",
    country: "Sint Maarten",
    confidence: "city",
  });
  assert.ok(lagoon);
  assert.deepEqual((lagoon as { providerCountryCodes?: readonly string[] }).providerCountryCodes, [
    "nl",
    "sx",
  ]);
});

test("alias declaration invariants (contract)", () => {
  for (const def of VERIFIED_PUBLIC_PIN_LOCATION_ALIAS_DEFINITIONS) {
    if ("acceptedSourceTexts" in def || "negativeSourceTexts" in def) {
      assert.ok(
        "canonicalProviderQuery" in def,
        `alias ${def.alias} has acceptedSourceTexts or negativeSourceTexts but no canonicalProviderQuery`
      );
    }
    assert.ok(def.countryCodes.length > 0, `alias ${def.alias} has empty countryCodes`);
    assert.ok(def.maxDistanceKm > 0, `alias ${def.alias} has non-positive maxDistanceKm`);
  }
});

test("public pin candidate lane checks both source text and cleaned query text", () => {
  assert.equal(
    isPublicPinLikelyGeocodeCandidate({
      locationText: "Athens, Alimos Marina, Mediterranean",
      queryText: "Alimos Marina, Athens, Greece",
    }),
    true
  );
  assert.equal(
    isPublicPinLikelyGeocodeCandidate({
      locationText: "Athens",
      queryText: "Athens, Greece",
    }),
    false
  );
  assert.equal(
    isPublicPinLikelyGeocodeCandidate({
      locationText: "Burnham Yacht Harbour",
      queryText: "Burnham Yacht Harbour, United Kingdom",
    }),
    true
  );
});

test("public pin candidate lane only promotes exact, street, and marina precision", () => {
  for (const precision of ["exact", "street", "marina"] as const) {
    assert.equal(isPublicPinEligiblePrecision(precision), true, precision);
    assert.equal(isPublicPinEligibleResult({ status: "geocoded", precision }), true, precision);
  }

  for (const precision of ["city", "region", "country", "unknown"] as const) {
    assert.equal(isPublicPinEligiblePrecision(precision), false, precision);
    assert.equal(isPublicPinEligibleResult({ status: "geocoded", precision }), false, precision);
  }

  assert.equal(isPublicPinEligibleResult({ status: "review", precision: "marina" }), false);
  assert.equal(isPublicPinEligibleResult({ status: "failed", precision: "exact" }), false);
});

test("public pin apply result holds back city results even when formatted text says marina", () => {
  const cityResult = {
    status: "geocoded",
    latitude: 25.0207877,
    longitude: -77.2740614,
    precision: "city",
    score: 1,
    placeName: "Palm Cay Marina, Palm Cay, Nassau, Bahamas",
    provider: "opencage",
    error: null,
  } satisfies GeocodeResult;

  assert.deepEqual(getPublicPinApplyResult(cityResult), {
    ...cityResult,
    status: "review",
    latitude: null,
    longitude: null,
    error: "public_pin_ineligible_precision",
  });
});

test("public pin apply result does not rewrite existing review outcomes", () => {
  const reviewResult = {
    status: "review",
    latitude: 19.20561,
    longitude: -69.33685,
    precision: "city",
    score: 0.22,
    placeName: "Samaná, Dominican Republic",
    provider: "opencage",
    error: "low_confidence",
  } satisfies GeocodeResult;

  assert.equal(getPublicPinApplyResult(reviewResult), reviewResult);
});

test("public pin eligibility rate and apply gate block weak batches", () => {
  assert.equal(getPublicPinEligibleRate(10, 25), 0.4);
  assert.equal(getPublicPinEligibleRate(15, 25), 0.6);
  assert.equal(getPublicPinEligibleRate(0, 0), 0);

  assert.deepEqual(
    getPublicPinApplyGateStop({
      apply: true,
      publicPinCandidates: true,
      selectedRows: 25,
      publicPinEligibleRate: 0.4,
    }),
    {
      stoppedReason: "public_pin_eligible_rate_below_threshold",
      message:
        "Public pin apply blocked: eligible precision rate 0.4 is below 0.6. Run a preview/source cleanup before applying.",
    }
  );

  assert.equal(
    getPublicPinApplyGateStop({
      apply: true,
      publicPinCandidates: true,
      selectedRows: 25,
      publicPinEligibleRate: 0.6,
    }),
    null
  );
  assert.equal(
    getPublicPinApplyGateStop({
      apply: false,
      publicPinCandidates: true,
      selectedRows: 25,
      publicPinEligibleRate: 0.4,
    }),
    null
  );
});
