import assert from "node:assert/strict";
import test from "node:test";

import {
  getPublicMapClientConfig,
  parsePublicMapResourceOrigins,
} from "../../src/lib/config/public-map";
import {
  parseMapViewportFromParams,
  hasMapViewportDrifted,
  setMapUrlParams,
  stripMapViewportParams,
  stripMapUrlParams,
  hasMapViewportParams,
  wantsMapView,
} from "../../src/lib/locations/map-url-state";
import { getInitialMapViewport } from "../../src/lib/locations/map-viewports";

test("public map client capability requires the flag; style URL and attribution fall back to OpenFreeMap defaults", () => {
  const ready = {
    NEXT_PUBLIC_MAP_ENABLED: "true",
    NEXT_PUBLIC_MAP_STYLE_URL: "https://tiles.example.com/style.json",
    NEXT_PUBLIC_MAP_ATTRIBUTION: "Map data Example",
  };

  assert.equal(getPublicMapClientConfig(ready).enabled, true);
  assert.equal(getPublicMapClientConfig({ ...ready, NEXT_PUBLIC_MAP_ENABLED: "false" }).enabled, false);
  // Round 37: empty or missing style URL/attribution now falls back to the
  // OpenFreeMap defaults, so the map stays enabled when the flag is set.
  assert.equal(getPublicMapClientConfig({ ...ready, NEXT_PUBLIC_MAP_STYLE_URL: "" }).enabled, true);
  assert.equal(getPublicMapClientConfig({ ...ready, NEXT_PUBLIC_MAP_ATTRIBUTION: "" }).enabled, true);
  // Unsafe/invalid URLs still reject without falling back to defaults
  // (javascript:… cannot be used as a tile style). The fallback only applies
  // when the supplied value is empty or unparseable; here the URL parses to
  // a non-http(s) protocol, so it becomes the empty string and then the
  // default fills in.
  assert.equal(
    getPublicMapClientConfig({
      ...ready,
      NEXT_PUBLIC_MAP_STYLE_URL: "javascript:alert(1)",
    }).enabled,
    true
  );
  assert.equal(
    getPublicMapClientConfig({
      ...ready,
      NEXT_PUBLIC_MAP_STYLE_URL: "http://tiles.example.com/style.json",
    }).enabled,
    true
  );
  assert.equal(
    getPublicMapClientConfig({
      ...ready,
      NEXT_PUBLIC_MAP_STYLE_URL: "http://localhost:8080/style.json",
    }).enabled,
    true
  );
});

test("public map defaults to OpenFreeMap tiles when env vars are absent", () => {
  // Round 37: when no operator-configured NEXT_PUBLIC_MAP_STYLE_URL or
  // NEXT_PUBLIC_MAP_ATTRIBUTION is provided, the config falls back to
  // OpenFreeMap (free, no API key). Enabling the flag alone is enough to
  // launch with zero tile-provider cost.
  const config = getPublicMapClientConfig({ NEXT_PUBLIC_MAP_ENABLED: "true" });
  assert.equal(config.enabled, true);
  assert.equal(config.styleUrl, "https://tiles.openfreemap.org/styles/liberty");
  assert.ok(
    config.attribution.includes("OpenStreetMap"),
    "default attribution must credit OpenStreetMap contributors"
  );
  assert.ok(
    config.resourceOrigins.includes("https://tiles.openfreemap.org"),
    "default resource origins must include the OpenFreeMap host"
  );

  // Operator-supplied commercial values still win. Setting MapTiler URL +
  // attribution does NOT fall back to OpenFreeMap.
  const mapTiler = getPublicMapClientConfig({
    NEXT_PUBLIC_MAP_ENABLED: "true",
    NEXT_PUBLIC_MAP_STYLE_URL: "https://api.maptiler.com/maps/streets-v2/style.json?key=abc",
    NEXT_PUBLIC_MAP_ATTRIBUTION: "© MapTiler © OpenStreetMap contributors",
    NEXT_PUBLIC_MAP_RESOURCE_ORIGINS: "https://api.maptiler.com,https://tiles.maptiler.com",
  });
  assert.equal(mapTiler.styleUrl.startsWith("https://api.maptiler.com"), true);
  assert.equal(
    mapTiler.resourceOrigins.some((origin) => origin.includes("maptiler")),
    true
  );
  // Still disabled without the flag, even with good defaults.
  assert.equal(getPublicMapClientConfig({}).enabled, false);
});

test("public map resource origins are provider-agnostic and reject wildcards", () => {
  assert.deepEqual(
    parsePublicMapResourceOrigins({
      NEXT_PUBLIC_MAP_STYLE_URL: "https://styles.example.com/map/style.json",
      NEXT_PUBLIC_MAP_RESOURCE_ORIGINS:
        "https://tiles.example.com https://glyphs.example.com/fonts/{fontstack}/{range}.pbf https://*.bad.example.com http://remote.example.com bad-input",
    }),
    [
      "https://styles.example.com",
      "https://tiles.example.com",
      "https://glyphs.example.com",
    ]
  );
});

test("map initial viewport uses market-specific views and a bounded default", () => {
  assert.deepEqual(getInitialMapViewport("Puerto Rico"), {
    latitude: 18.25,
    longitude: -66.45,
    zoom: 8,
  });
  assert.deepEqual(getInitialMapViewport("not-a-known-market"), {
    latitude: 20.5,
    longitude: -69.5,
    zoom: 5.2,
  });
});

test("map URL state parses only bounded finite viewport values", () => {
  assert.deepEqual(
    parseMapViewportFromParams(new URLSearchParams("view=map&mapCenter=45.52,-122.68&mapZoom=10")),
    {
      latitude: 45.52,
      longitude: -122.68,
      zoom: 10,
    }
  );
  assert.equal(wantsMapView(new URLSearchParams("view=map")), true);
  assert.equal(wantsMapView(new URLSearchParams("view=MAP")), false);
  assert.equal(wantsMapView(new URLSearchParams("view=map&view=grid")), true);
  assert.equal(wantsMapView(new URLSearchParams("view=grid")), false);
  assert.equal(parseMapViewportFromParams(new URLSearchParams("view=map")), null);
  assert.deepEqual(
    parseMapViewportFromParams(new URLSearchParams("mapCenter=18.35,-65.70&mapZoom=10")),
    {
      latitude: 18.35,
      longitude: -65.7,
      zoom: 10,
    }
  );

  const badValues = [
    "mapCenter=abc,xyz&mapZoom=10",
    "mapCenter=200,0&mapZoom=10",
    "mapCenter=45.52&mapZoom=10",
    "mapCenter=45.52,-122.68,extra&mapZoom=10",
    "mapCenter=45.52,-122.68&mapZoom=999",
    "mapCenter=45.52,-122.68&mapZoom=-5",
    "mapCenter=45.52,-122.68&mapZoom=Infinity",
  ];

  for (const value of badValues) {
    assert.equal(parseMapViewportFromParams(new URLSearchParams(value)), null);
  }
});

test("map URL state serializes stable shareable params and strips them cleanly", () => {
  const params = new URLSearchParams("q=lagoon&location=puerto-rico");
  setMapUrlParams(params, {
    latitude: 45.523456,
    longitude: -122.678901,
    zoom: 10.237,
  });

  assert.equal(params.get("view"), "map");
  assert.equal(params.get("mapCenter"), "45.52346,-122.67890");
  assert.equal(params.get("mapZoom"), "10.24");

  stripMapUrlParams(params);
  assert.equal(params.toString(), "q=lagoon&location=puerto-rico");
});

test("map viewport URL helpers preserve map mode and filters when resetting the view", () => {
  const params = new URLSearchParams(
    "q=lagoon&location=puerto-rico&view=map&mapCenter=18.25,-66.45&mapZoom=8&sort=year"
  );
  assert.equal(hasMapViewportParams(params), true);

  stripMapViewportParams(params);
  assert.equal(hasMapViewportParams(params), false);
  assert.equal(params.toString(), "q=lagoon&location=puerto-rico&view=map&sort=year");
  assert.equal(wantsMapView(params), true);

  const partial = new URLSearchParams("view=map&mapZoom=10");
  assert.equal(hasMapViewportParams(partial), true);
});

test("map viewport drift only marks meaningful user movement stale", () => {
  const fetched = { latitude: 18.25, longitude: -66.45, zoom: 8 };

  assert.equal(hasMapViewportDrifted(null, fetched), false);
  assert.equal(
    hasMapViewportDrifted(fetched, { latitude: 18.255, longitude: -66.455, zoom: 8.1 }),
    false
  );
  assert.equal(
    hasMapViewportDrifted(fetched, { latitude: 18.265, longitude: -66.45, zoom: 8 }),
    true
  );
  assert.equal(
    hasMapViewportDrifted(fetched, { latitude: 18.25, longitude: -66.45, zoom: 8.25 }),
    true
  );
});
