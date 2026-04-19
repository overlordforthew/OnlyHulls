import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGeocodeQuery,
  geocodeWithNominatim,
  getGeocodeCandidateReason,
  type GeocodingConfig,
} from "../../src/lib/locations/geocoding";

const baseConfig: GeocodingConfig = {
  provider: "nominatim",
  enabled: true,
  baseUrl: "https://geocode.test/search",
  userAgent: "OnlyHulls test",
  email: null,
  delayMs: 0,
  timeoutMs: 1000,
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
});

test("geocodeWithNominatim requires an identifying user agent", async () => {
  const result = await geocodeWithNominatim(
    { queryText: "Cannes, France", queryKey: "cannes france", countryHint: "fr" },
    { ...baseConfig, userAgent: null }
  );

  assert.equal(result.status, "skipped");
  assert.equal(result.error, "missing_user_agent");
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
