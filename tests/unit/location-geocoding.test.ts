import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGeocodeQuery,
  deriveCountryGeocodeResult,
  geocodeWithOpenCage,
  geocodeWithNominatim,
  getGeocodeCandidateReason,
  getGeocodingConfig,
  reviewGeocodeResultQuality,
  type GeocodingConfig,
} from "../../src/lib/locations/geocoding";
import { classifyGeocodeReviewIssue } from "../../src/lib/locations/geocode-triage";

const baseConfig: GeocodingConfig = {
  provider: "nominatim",
  enabled: true,
  apiKey: null,
  baseUrl: "https://geocode.test/search",
  userAgent: "OnlyHulls test",
  email: null,
  delayMs: 0,
  timeoutMs: 1000,
};

const openCageConfig: GeocodingConfig = {
  ...baseConfig,
  provider: "opencage",
  apiKey: "test-open-cage-key",
  baseUrl: "https://opencage.test/geocode/v1/json",
  delayMs: 0,
};

test("buildGeocodeQuery prepares specific city queries with country hints", () => {
  const query = buildGeocodeQuery({
    locationText: "Cannes",
    country: "France",
    confidence: "city",
  });

  assert.deepEqual(query, {
    queryText: "Cannes, France",
    queryKey: "cannes france",
    countryHint: "fr",
  });
});

test("buildGeocodeQuery uses corrected country hints for ambiguous boat locations", () => {
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Parlin, New Jersey",
      country: "United States",
      confidence: "city",
    }),
    {
      queryText: "Parlin, New Jersey, United States",
      queryKey: "parlin new jersey united states",
      countryHint: "us",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Cartagena De Indias Colombia",
      country: "Colombia",
      confidence: "city",
    }),
    {
      queryText: "Cartagena De Indias, Colombia",
      queryKey: "cartagena de indias colombia",
      countryHint: "co",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Aegean, Turkey",
      country: "Turkey",
      confidence: "city",
    }),
    {
      queryText: "Aegean, Turkey",
      queryKey: "aegean turkey",
      countryHint: "tr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Tortola (Caribbean)",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Tortola, British Virgin Islands",
      queryKey: "tortola british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Tortola, Virgin Islands, British",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Tortola, British Virgin Islands",
      queryKey: "tortola british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "St. Thomas, US Virgin Islands",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "St. Thomas, US Virgin Islands",
      queryKey: "st thomas us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Green Cay Marina, St Croix, Virgin Islands (US) (USVI)",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Christiansted, US Virgin Islands",
      queryKey: "christiansted us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "St. Thomas, Virgin Islands",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "St. Thomas, US Virgin Islands",
      queryKey: "st thomas us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "St. Thomas",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "St. Thomas, US Virgin Islands",
      queryKey: "st thomas us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "St. John Us, Virgin Islands",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "St. John, US Virgin Islands",
      queryKey: "st john us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Virgin Gorda Boatyard, Virgin Islands (British) (BVI)",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    null
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "&#8239;Shoreline&#8239;Marina, &#8239;Long&#8239;Beach, &#8239;California Price:&#8239;$52, 500",
      country: "United States",
      confidence: "city",
    }),
    {
      queryText: "Long Beach, California, United States",
      queryKey: "long beach california united states",
      countryHint: "us",
    }
  );
});

test("buildGeocodeQuery strips marine tokens and keeps city/country-only", () => {
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Athens, Alimos Marina, Mediterranean",
      country: "Greece",
      confidence: "city",
    }),
    {
      queryText: "Athens, Greece",
      queryKey: "athens greece",
      countryHint: "gr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Carlyle West Access Marina, Illinois",
      country: null,
      confidence: "unknown",
    }),
    null
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Trogir, Yachtclub Seget (Marina Baotić), Mediterranean",
      country: "Croatia",
      confidence: "city",
    }),
    {
      queryText: "Seget Donji, Croatia",
      queryKey: "seget donji croatia",
      countryHint: "hr",
    }
  );
});

test("buildGeocodeQuery rejects generic or region-only locations", () => {
  assert.equal(
    buildGeocodeQuery({
      locationText: "West Coast",
      country: "United States",
      confidence: "region",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Mediterranean",
      confidence: "region",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "South Of, France",
      country: "France",
      confidence: "city",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Grenada, West Indies",
      country: "Grenada",
      confidence: "city",
    }),
    null
  );
  assert.equal(getGeocodeCandidateReason({ locationText: "", confidence: "unknown" }), "missing_location");
  assert.equal(
    getGeocodeCandidateReason({
      locationText: "Cannes",
      country: "France",
      confidence: "city",
    }),
    "ready"
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Maryland",
      country: "United States",
      confidence: "region",
    }),
    null
  );
  assert.equal(
    getGeocodeCandidateReason({
      locationText: "Maryland",
      country: "United States",
      confidence: "region",
    }),
    "needs_more_specific_location"
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "France",
      country: "France",
      confidence: "city",
    }),
    null
  );
  assert.equal(
    getGeocodeCandidateReason({
      locationText: "France",
      country: "France",
      confidence: "city",
    }),
    "needs_more_specific_location"
  );
});

test("geocodeWithNominatim requires an identifying user agent", async () => {
  const result = await geocodeWithNominatim(
    { queryText: "Cannes, France", queryKey: "cannes france", countryHint: "fr" },
    { ...baseConfig, userAgent: null }
  );

  assert.equal(result.status, "skipped");
  assert.equal(result.error, "missing_user_agent");
});

  test("geocode review triage separates enrichment work from provider retries", () => {
  assert.deepEqual(classifyGeocodeReviewIssue({ status: "review", error: "no_result" }), {
    category: "cleanup_source_text",
    action: "Improve the source location with a city, marina, or country before retrying.",
    retryable: false,
    blocksMap: true,
  });
  assert.deepEqual(classifyGeocodeReviewIssue({ status: "failed", error: "This operation was aborted" }), {
    category: "provider_health",
    action: "Retry after provider health, quota, or network issue is resolved.",
    retryable: true,
    blocksMap: true,
  });
  assert.deepEqual(classifyGeocodeReviewIssue({ status: "review", error: "low_precision", precision: "region" }), {
    category: "manual_enrichment",
    action: "Add more specific location detail; broad regional results must stay off the public map.",
    retryable: false,
    blocksMap: true,
  });
  assert.deepEqual(classifyGeocodeReviewIssue({ status: "review", countryHintMismatch: true }), {
    category: "cleanup_source_text",
    action: "Fix the stored country or source location before paid geocoding.",
    retryable: false,
    blocksMap: true,
  });
});

test("getGeocodingConfig enables OpenCage only when an api key is present", () => {
  const originalProvider = process.env.LOCATION_GEOCODING_PROVIDER;
  const originalApiKey = process.env.LOCATION_GEOCODING_API_KEY;
  const originalLegacyApiKey = process.env.GEOCODING_API_KEY;
  const originalOpenCageKey = process.env.OPENCAGE_API_KEY;
  const originalDelay = process.env.LOCATION_GEOCODING_DELAY_MS;
  const originalBaseUrl = process.env.LOCATION_GEOCODING_BASE_URL;

  try {
    delete process.env.LOCATION_GEOCODING_API_KEY;
    delete process.env.GEOCODING_API_KEY;
    delete process.env.OPENCAGE_API_KEY;
    delete process.env.LOCATION_GEOCODING_DELAY_MS;
    delete process.env.LOCATION_GEOCODING_BASE_URL;
    process.env.LOCATION_GEOCODING_PROVIDER = "opencage";

    const missingKey = getGeocodingConfig();
    assert.equal(missingKey.provider, "opencage");
    assert.equal(missingKey.enabled, false);
    assert.equal(missingKey.delayMs, 200);

    process.env.LOCATION_GEOCODING_API_KEY = "configured-key";
    const configured = getGeocodingConfig();
    assert.equal(configured.provider, "opencage");
    assert.equal(configured.enabled, true);
    assert.equal(configured.apiKey, "configured-key");
    assert.equal(configured.baseUrl, "https://api.opencagedata.com/geocode/v1/json");
  } finally {
    if (originalProvider === undefined) delete process.env.LOCATION_GEOCODING_PROVIDER;
    else process.env.LOCATION_GEOCODING_PROVIDER = originalProvider;
    if (originalApiKey === undefined) delete process.env.LOCATION_GEOCODING_API_KEY;
    else process.env.LOCATION_GEOCODING_API_KEY = originalApiKey;
    if (originalLegacyApiKey === undefined) delete process.env.GEOCODING_API_KEY;
    else process.env.GEOCODING_API_KEY = originalLegacyApiKey;
    if (originalOpenCageKey === undefined) delete process.env.OPENCAGE_API_KEY;
    else process.env.OPENCAGE_API_KEY = originalOpenCageKey;
    if (originalDelay === undefined) delete process.env.LOCATION_GEOCODING_DELAY_MS;
    else process.env.LOCATION_GEOCODING_DELAY_MS = originalDelay;
    if (originalBaseUrl === undefined) delete process.env.LOCATION_GEOCODING_BASE_URL;
    else process.env.LOCATION_GEOCODING_BASE_URL = originalBaseUrl;
  }
});

test("geocodeWithNominatim parses a city result without network access", async () => {
  const originalFetch = globalThis.fetch;
  const requested: Array<{ url: string; userAgent: string | null }> = [];

  globalThis.fetch = (async (url, init) => {
    const requestUrl = url instanceof URL ? url : new URL(String(url));
    requested.push({
      url: requestUrl.toString(),
      userAgent: init?.headers instanceof Headers
        ? init.headers.get("User-Agent")
        : (init?.headers as Record<string, string> | undefined)?.["User-Agent"] || null,
    });

    return new Response(
      JSON.stringify([
        {
          lat: "43.5528",
          lon: "7.0174",
          display_name: "Cannes, Alpes-Maritimes, France",
          addresstype: "city",
          type: "city",
          class: "boundary",
          place_rank: 16,
          importance: 0.61,
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await geocodeWithNominatim(
      { queryText: "Cannes, France", queryKey: "cannes france", countryHint: "fr" },
      baseConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.latitude, 43.5528);
    assert.equal(result.longitude, 7.0174);
    assert.equal(requested.length, 1);
    assert.match(requested[0].url, /q=Cannes%2C\+France/);
    assert.match(requested[0].url, /countrycodes=fr/);
    assert.equal(requested[0].userAgent, "OnlyHulls test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithNominatim does not treat county boundaries as city precision", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        {
          lat: "35.8725573",
          lon: "-76.6215245",
          display_name: "Washington County, North Carolina, United States",
          addresstype: "county",
          type: "administrative",
          class: "boundary",
          place_rank: 12,
          importance: 0.55,
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithNominatim(
      {
        queryText: "Washington, North Carolina, United States",
        queryKey: "washington north carolina united states",
        countryHint: "us",
      },
      baseConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.precision, "unknown");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage requires an api key", async () => {
  const result = await geocodeWithOpenCage(
    { queryText: "Cannes, France", queryKey: "cannes france", countryHint: "fr" },
    { ...openCageConfig, apiKey: null }
  );

  assert.equal(result.status, "skipped");
  assert.equal(result.error, "missing_api_key");
});

test("geocodeWithOpenCage parses a city result and sends scoped request params", async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];

  globalThis.fetch = (async (url) => {
    const requestUrl = url instanceof URL ? url : new URL(String(url));
    requested.push(requestUrl.toString());

    return new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Cannes, Alpes-Maritimes, France",
            geometry: { lat: 43.5528, lng: 7.0174 },
            confidence: 7,
            components: {
              _type: "city",
              city: "Cannes",
              country: "France",
              country_code: "fr",
              state: "Provence-Alpes-Cote d'Azur",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      { queryText: "Cannes, France", queryKey: "cannes france", countryHint: "fr" },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.latitude, 43.5528);
    assert.equal(result.longitude, 7.0174);
    assert.equal(result.placeName, "Cannes, Alpes-Maritimes, France");
    assert.equal(requested.length, 1);
    assert.match(requested[0], /key=test-open-cage-key/);
    assert.match(requested[0], /q=Cannes%2C\+France/);
    assert.match(requested[0], /limit=1/);
    assert.match(requested[0], /no_annotations=1/);
    assert.match(requested[0], /countrycode=fr/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts exact confidence-three city-country results for search coverage", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Lelystad, Flevoland, Netherlands",
            geometry: { lat: 52.5150949, lng: 5.4768915 },
            confidence: 3,
            components: {
              _type: "city",
              city: "Lelystad",
              country: "Netherlands",
              country_code: "nl",
              state: "Flevoland",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Lelystad, Netherlands",
        queryKey: "lelystad netherlands",
        countryHint: "nl",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.error, null);
    assert.equal(result.score, 0.42);
    assert.equal(result.latitude, 52.5150949);
    assert.equal(result.longitude, 5.4768915);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage keeps unsafe confidence-three city-like results in review", async () => {
  const originalFetch = globalThis.fetch;
  const cases = [
    {
      name: "confidence below floor",
      query: {
        queryText: "Lelystad, Netherlands",
        queryKey: "lelystad netherlands",
        countryHint: "nl",
      },
      result: {
        // Round 32 adjusted the `exact City, Country` exception to accept
        // confidence=2 when the primary city component exactly matches the
        // queried city part. Dropping the confidence to 1 keeps this case in
        // the "still unsafe" test bucket — truly low-confidence results must
        // remain in review regardless of how clean the component is.
        formatted: "Lelystad, Flevoland, Netherlands",
        geometry: { lat: 52.5150949, lng: 5.4768915 },
        confidence: 1,
        components: {
          _type: "city",
          city: "Lelystad",
          country: "Netherlands",
          country_code: "nl",
        },
      },
      precision: "city",
      error: "low_confidence",
    },
    {
      // Round 34 extended the exception to 3-part City,Region,Country. To
      // preserve "unsafe" test coverage, replace this 3-part case with a
      // 4-part query which the exception still rejects.
      name: "four-part city-region-region-country query",
      query: {
        queryText: "Cannes, Alpes-Maritimes, Provence, France",
        queryKey: "cannes alpes maritimes provence france",
        countryHint: "fr",
      },
      result: {
        formatted: "Cannes, Alpes-Maritimes, France",
        geometry: { lat: 43.5528, lng: 7.0174 },
        confidence: 3,
        components: {
          _type: "city",
          city: "Cannes",
          country: "France",
          country_code: "fr",
          state: "Provence-Alpes-Cote d'Azur",
        },
      },
      precision: "city",
      error: "low_confidence",
    },
    {
      name: "country hint mismatch",
      query: {
        queryText: "Lelystad, Netherlands",
        queryKey: "lelystad netherlands",
        countryHint: "nl",
      },
      result: {
        formatted: "Lelystad, Belgium",
        geometry: { lat: 50.9, lng: 4.4 },
        confidence: 3,
        components: {
          _type: "city",
          city: "Lelystad",
          country: "Belgium",
          country_code: "be",
        },
      },
      precision: "city",
      error: "low_confidence",
    },
    {
      name: "formatted result missing queried city",
      query: {
        queryText: "Lelystad, Netherlands",
        queryKey: "lelystad netherlands",
        countryHint: "nl",
      },
      result: {
        formatted: "Almere, Flevoland, Netherlands",
        geometry: { lat: 52.3508, lng: 5.2647 },
        confidence: 3,
        components: {
          _type: "city",
          city: "Almere",
          country: "Netherlands",
          country_code: "nl",
        },
      },
      precision: "city",
      error: "low_confidence",
    },
    {
      name: "street component on city-typed result",
      query: {
        queryText: "Lelystad, Netherlands",
        queryKey: "lelystad netherlands",
        countryHint: "nl",
      },
      result: {
        formatted: "Station Road, Lelystad, Flevoland, Netherlands",
        geometry: { lat: 52.51, lng: 5.47 },
        confidence: 3,
        components: {
          _type: "city",
          city: "Lelystad",
          road: "Station Road",
          country: "Netherlands",
          country_code: "nl",
        },
      },
      precision: "city",
      error: "low_confidence",
    },
  ] as const;

  try {
    for (const item of cases) {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ results: [item.result] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as typeof fetch;

      const result = await geocodeWithOpenCage(item.query, openCageConfig);
      assert.equal(result.status, "review", item.name);
      assert.equal(result.precision, item.precision, item.name);
      assert.equal(result.error, item.error, item.name);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage routes county boundaries to reviewable region precision", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Washington County, North Carolina, United States",
            geometry: { lat: 35.8725573, lng: -76.6215245 },
            confidence: 3,
            components: {
              _type: "county",
              county: "Washington County",
              state: "North Carolina",
              country: "United States",
              country_code: "us",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Washington, North Carolina, United States",
        queryKey: "washington north carolina united states",
        countryHint: "us",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.precision, "unknown");
    assert.equal(result.error, "low_precision");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage holds POI results for city-level queries", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Vancouver Island Regional Library - Nanaimo North Branch, 6250 Hammond Bay Road, Nanaimo, BC V9T, Canada",
            geometry: { lat: 49.2350034, lng: -124.0384586 },
            confidence: 10,
            components: {
              _type: "road",
              road: "Hammond Bay Road",
              city: "Nanaimo",
              state: "British Columbia",
              country: "Canada",
              country_code: "ca",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Nanaimo Vancouver Island, Canada",
        queryKey: "nanaimo vancouver island canada",
        countryHint: "ca",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.precision, "unknown");
    assert.equal(result.error, "low_precision");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage holds degenerate one-token import fragments for review", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "s, 84600 Grillon, France",
            geometry: { lat: 44.3901329, lng: 4.9497074 },
            confidence: 10,
            components: {
              _type: "hamlet",
              hamlet: "s",
              country: "France",
              country_code: "fr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      { queryText: "S, France", queryKey: "s france", countryHint: "fr" },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.error, "degenerate_query");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage holds broad waterbody queries that resolve to businesses", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Ionian Sea Hotel, Mantzavinata - Favata, 282 00 Paliki Municipal Unit, Greece",
            geometry: { lat: 38.1557011, lng: 20.3860003 },
            confidence: 10,
            components: {
              _type: "hotel",
              _category: "accommodation",
              tourism: "hotel",
              country: "Greece",
              country_code: "gr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      { queryText: "Ionian Sea, Greece", queryKey: "ionian sea greece", countryHint: "gr" },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.error, "waterbody_poi_mismatch");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cached geocode quality review reclassifies stale accepted bad rows", () => {
  const result = reviewGeocodeResultQuality("Ionian Sea, Greece", {
    status: "geocoded",
    latitude: 38.1557011,
    longitude: 20.3860003,
    precision: "city",
    score: 1,
    placeName: "Ionian Sea Hotel, Mantzavinata, Greece",
    provider: "opencage",
    payload: {
      components: {
        _type: "hotel",
        _category: "accommodation",
      },
    },
    error: null,
  });

  assert.equal(result.status, "review");
  assert.equal(result.error, "waterbody_poi_mismatch");
});

test("geocodeWithOpenCage holds directional fragments that resolve to POIs", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Nefeli Hotel, Komotinis - Alexandroupolis, 681 00 Nea Chili, Greece",
            geometry: { lat: 40.8540497, lng: 25.8065251 },
            confidence: 10,
            components: {
              _type: "hotel",
              _category: "accommodation",
              tourism: "hotel",
              country: "Greece",
              country_code: "gr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      { queryText: "West, Greece", queryKey: "west greece", countryHint: "gr" },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.error, "directional_fragment_poi");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage holds ambiguous coastal names that resolve inland", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Argentario, Trento, Italy",
            geometry: { lat: 46.0921068, lng: 11.1451359 },
            confidence: 7,
            components: {
              _type: "city",
              city: "Argentario",
              county: "Trento",
              state: "Trentino-Alto Adige",
              country: "Italy",
              country_code: "it",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      { queryText: "Argentario, Italy", queryKey: "argentario italy", countryHint: "it" },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.error, "ambiguous_coastal_name");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("coastal-name guard accepts the vetted Argentario coastal area", () => {
  const result = reviewGeocodeResultQuality("Argentario, Italy", {
    status: "geocoded",
    latitude: 42.434,
    longitude: 11.119,
    precision: "city",
    score: 0.82,
    placeName: "58019 Monte Argentario GR, Italy",
    provider: "opencage",
    payload: {
      components: {
        _type: "town",
        town: "Monte Argentario",
        county: "Grosseto",
        state: "Tuscany",
        country: "Italy",
        country_code: "it",
      },
    },
    error: null,
  });

  assert.equal(result.status, "geocoded");
  assert.equal(result.error, null);
});

test("geocodeWithOpenCage does not infer marina from harbourside substrings", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Harbourside Kitchen, Strattonhall Drift, East Suffolk, IP10 0LN, United Kingdom",
            geometry: { lat: 51.9965539, lng: 1.2717108 },
            confidence: 10,
            components: {
              _type: "restaurant",
              _category: "commerce",
              amenity: "restaurant",
              road: "Strattonhall Drift",
              county: "East Suffolk",
              postcode: "IP10 0LN",
              country: "United Kingdom",
              country_code: "gb",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Suffolk Yacht Harbour, United Kingdom",
        queryKey: "suffolk yacht harbour united kingdom",
        countryHint: "gb",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.precision, "unknown");
    assert.equal(result.error, "low_precision");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage does not infer marina from Dover road or pier text", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Dover Pier, New Marina Curve Road, Dover, CT17 9FJ, United Kingdom",
            geometry: { lat: 51.1191352, lng: 1.317098 },
            confidence: 10,
            components: {
              _type: "pier",
              pier: "Dover Pier",
              road: "New Marina Curve Road",
              town: "Dover",
              country: "United Kingdom",
              country_code: "gb",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Dover Marina, Kent, United Kingdom",
        queryKey: "dover marina kent united kingdom",
        countryHint: "gb",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts confidence=2 exact City,Country when primary city component matches exactly", async () => {
  // Round 32 extension: conf=2 2-part City,Country queries were previously held
  // in review even when the provider returned the correct city. Extension allows
  // conf=2 when components.city (or town/village/etc.) EXACTLY equals the
  // queried city part. Bodrum/Marmaris/Corfu cases unblock; ambiguous-name
  // traps still fail because the provider's primary component won't match
  // exactly.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Bodrum, Turkey",
            geometry: { lat: 37.0344, lng: 27.4305 },
            confidence: 2,
            components: {
              _type: "city",
              city: "Bodrum",
              state: "Muğla",
              country: "Turkey",
              country_code: "tr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Bodrum, Turkey",
        queryKey: "bodrum turkey",
        countryHint: "tr",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage still holds confidence=2 City,Country when city component differs", async () => {
  // Round 32 guard: conf=2 is only accepted when the primary city component
  // EXACTLY matches the queried city. If provider returned a similarly-named
  // but different city, we must still hold it in review.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Springfield, IL, United States of America",
            geometry: { lat: 39.78, lng: -89.65 },
            confidence: 2,
            components: {
              _type: "city",
              city: "Springfield",
              state: "Illinois",
              country: "United States of America",
              country_code: "us",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    // Query is `Springfield, United Kingdom` — a made-up ambiguous case.
    // Provider country_code=us mismatches queryParts.countryCode=gb → rejected.
    const result = await geocodeWithOpenCage(
      {
        queryText: "Springfield, United Kingdom",
        queryKey: "springfield united kingdom",
        countryHint: "gb",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage holds confidence=2 when primary city component mismatches the queried city", async () => {
  // Sibling guard: same country but provider's primary component is a
  // DIFFERENT same-country city. Only the city-component-equality check saves
  // us here — the loose conf=3 text-inclusion would falsely accept.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Mudanya, Bursa, Turkey",
            geometry: { lat: 40.37, lng: 28.88 },
            confidence: 2,
            components: {
              _type: "city",
              city: "Mudanya",
              state: "Bursa",
              country: "Turkey",
              country_code: "tr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    // Query is `Bursa, Turkey` but provider returned Mudanya (a town inside
    // Bursa province). The loose text-inclusion check would pass because
    // formatted text contains "Bursa". The tight component-equality check
    // rejects because components.city=Mudanya !== "bursa".
    const result = await geocodeWithOpenCage(
      {
        queryText: "Bursa, Turkey",
        queryKey: "bursa turkey",
        countryHint: "tr",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts overseas-territory ↔ sovereign country-code equivalence for exact City,Country", async () => {
  // Round 35: OpenCage reports Martinique with country_code=fr even when the
  // query countryHint is `mq` (the ISO alpha-2 for Martinique). Equivalence
  // list accepts mq↔fr, vg↔gb, vi↔us, sx↔nl, pf↔fr, etc.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Le Marin, Martinique, France",
            geometry: { lat: 14.471, lng: -60.87 },
            confidence: 3,
            components: {
              _type: "municipality",
              city: "Le Marin",
              state: "Martinique",
              country: "France",
              country_code: "fr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Le Marin, Martinique",
        queryKey: "le marin martinique",
        countryHint: "mq",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage still rejects non-equivalent country-code mismatches at conf=3", async () => {
  // Round 35 safety: mq↔fr equivalence does NOT imply mq↔es. A similar-sounding
  // place in Spain with Spanish country code must stay rejected when query
  // expected Martinique.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Marin, Pontevedra, Spain",
            geometry: { lat: 42.4, lng: -8.7 },
            confidence: 3,
            components: {
              _type: "city",
              city: "Marin",
              country: "Spain",
              country_code: "es",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Le Marin, Martinique",
        queryKey: "le marin martinique",
        countryHint: "mq",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts 3-part City,Region,Country at confidence=3 via the exact-city exception", async () => {
  // Round 34: the Round 21 `exact City, Country` exception was widened to also
  // accept `City, Region, Country` 3-part queries. Region is additional
  // narrowing; it must be a real region token (not another country, not broad).
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Alicante, Valencian Community, Spain",
            geometry: { lat: 38.3452, lng: -0.481 },
            confidence: 3,
            components: {
              _type: "city",
              city: "Alicante",
              state: "Valencian Community",
              country: "Spain",
              country_code: "es",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Alicante, Valencian Community, Spain",
        queryKey: "alicante valencian community spain",
        countryHint: "es",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage still rejects 3-part queries when city component mismatches", async () => {
  // Round 34 safety: 3-part extension must still reject wrong-city provider
  // responses. Here the provider returned a same-country different city.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Valencia, Valencian Community, Spain",
            geometry: { lat: 39.47, lng: -0.37 },
            confidence: 3,
            components: {
              _type: "city",
              city: "Valencia",
              state: "Valencian Community",
              country: "Spain",
              country_code: "es",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Alicante, Valencian Community, Spain",
        queryKey: "alicante valencian community spain",
        countryHint: "es",
      },
      openCageConfig
    );

    // Loose conf=3 check: result text does not contain "alicante" → rejected.
    assert.equal(result.status, "review");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage rejects 3-part queries when middle part is itself a country", async () => {
  // Round 34 safety: `City, Country, Country` nonsense pattern must be rejected
  // because the middle part resolving to a country code indicates the query is
  // malformed, not a clean City,Region,Country.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Some place, France, Spain",
            geometry: { lat: 40, lng: 0 },
            confidence: 3,
            components: {
              _type: "city",
              city: "Someplace",
              country: "Spain",
              country_code: "es",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Someplace, France, Spain",
        queryKey: "someplace france spain",
        countryHint: "es",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deriveCountryGeocodeResult resolves stored country to centroid with country precision", () => {
  const result = deriveCountryGeocodeResult({
    locationText: null,
    country: "Greece",
    region: null,
    marketSlugs: null,
    confidence: null,
  });
  assert.ok(result);
  assert.equal(result?.status, "geocoded");
  assert.equal(result?.precision, "country");
  assert.equal(result?.provider, "derived");
  assert.equal(result?.score, 1);
  assert.equal(result?.placeName, "Greece");
  assert.ok(typeof result?.latitude === "number" && result.latitude >= -90 && result.latitude <= 90);
  assert.ok(typeof result?.longitude === "number" && result.longitude >= -180 && result.longitude <= 180);
});

test("deriveCountryGeocodeResult returns null when country is missing or unknown", () => {
  assert.equal(
    deriveCountryGeocodeResult({ country: null }),
    null
  );
  assert.equal(
    deriveCountryGeocodeResult({ country: "" }),
    null
  );
  assert.equal(
    deriveCountryGeocodeResult({ country: "Atlantis" }),
    null
  );
});

test("deriveCountryGeocodeResult ignores locationText — the stored country is the only authority", () => {
  // Boat with text like "Alimos Marina, Athens, Greece" but no country field:
  // the derivation does not parse text. Provider pipeline handles specific text;
  // derivation only fires when country is the sole reliable signal.
  const result = deriveCountryGeocodeResult({
    locationText: "Alimos Marina, Athens, Greece",
    country: null,
  });
  assert.equal(result, null);
});

test("geocodeWithOpenCage accepts country precision as geocoded under the country-minimum policy", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: { code: 200, message: "OK" },
          total_results: 1,
          results: [
            {
              components: {
                _type: "country",
                country: "Greece",
                country_code: "gr",
                "ISO_3166-1_alpha-2": "GR",
              },
              confidence: 1,
              formatted: "Greece",
              geometry: { lat: 39.0742, lng: 21.8243 },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )) as typeof fetch;

    const result = await geocodeWithOpenCage(
      { queryText: "Greece", queryKey: "greece", countryHint: "gr" },
      openCageConfig
    );

    assert.equal(result.precision, "country");
    assert.equal(result.status, "geocoded");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
