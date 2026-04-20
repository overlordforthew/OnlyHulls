import assert from "node:assert/strict";
import test from "node:test";

import {
  getPublicMapClientConfig,
  parsePublicMapResourceOrigins,
} from "../../src/lib/config/public-map";
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
