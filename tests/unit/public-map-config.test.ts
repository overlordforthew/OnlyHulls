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

test("public map client capability requires flag, style URL, and attribution", () => {
  const ready = {
    NEXT_PUBLIC_MAP_ENABLED: "true",
    NEXT_PUBLIC_MAP_STYLE_URL: "https://tiles.example.com/style.json",
    NEXT_PUBLIC_MAP_ATTRIBUTION: "Map data Example",
  };

  assert.equal(getPublicMapClientConfig(ready).enabled, true);
  assert.equal(getPublicMapClientConfig({ ...ready, NEXT_PUBLIC_MAP_ENABLED: "false" }).enabled, false);
  assert.equal(getPublicMapClientConfig({ ...ready, NEXT_PUBLIC_MAP_STYLE_URL: "" }).enabled, false);
  assert.equal(getPublicMapClientConfig({ ...ready, NEXT_PUBLIC_MAP_ATTRIBUTION: "" }).enabled, false);
  assert.equal(
    getPublicMapClientConfig({
      ...ready,
      NEXT_PUBLIC_MAP_STYLE_URL: "javascript:alert(1)",
    }).enabled,
    false
  );
  assert.equal(
    getPublicMapClientConfig({
      ...ready,
      NEXT_PUBLIC_MAP_STYLE_URL: "http://tiles.example.com/style.json",
    }).enabled,
    false
  );
  assert.equal(
    getPublicMapClientConfig({
      ...ready,
      NEXT_PUBLIC_MAP_STYLE_URL: "http://localhost:8080/style.json",
    }).enabled,
    true
  );
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
