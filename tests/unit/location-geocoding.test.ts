import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGeocodeQuery,
  geocodeWithOpenCage,
  geocodeWithNominatim,
  getGeocodeCandidateReason,
  getGeocodingConfig,
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
      queryText: "Cartagena De Indias Colombia",
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

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "region");
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
    assert.equal(result.precision, "region");
    assert.equal(result.error, "low_confidence");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage rejects low-confidence street pins", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Cannes Marina Road, France",
            geometry: { lat: 43.5528, lng: 7.0174 },
            confidence: 5,
            components: {
              _type: "road",
              road: "Marina Road",
              city: "Cannes",
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
      { queryText: "Cannes Marina, France", queryKey: "cannes marina france", countryHint: "fr" },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.precision, "street");
    assert.equal(result.error, "low_confidence");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage maps provider quota and rate errors to review", async () => {
  const originalFetch = globalThis.fetch;

  try {
    for (const status of [402, 403, 429, 503]) {
      globalThis.fetch = (async () => new Response("{}", { status })) as typeof fetch;

      const result = await geocodeWithOpenCage(
        { queryText: "Cannes, France", queryKey: "cannes france", countryHint: "fr" },
        openCageConfig
      );

      assert.equal(result.status, "review");
      assert.equal(result.error, `http_${status}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
