import test from "node:test";
import assert from "node:assert/strict";

import { parseMapBounds, parseMapMarkerLimit } from "../../src/lib/locations/map-bounds";
import { getPublicMapCoordinate } from "../../src/lib/locations/map-coordinates";

test("public map coordinates require a precise enough geocode signal", () => {
  assert.equal(
    getPublicMapCoordinate({
      latitude: 5.4141,
      longitude: 100.3288,
      precision: null,
    }),
    null
  );

  assert.equal(
    getPublicMapCoordinate({
      latitude: 5.4141,
      longitude: 100.3288,
      precision: "region",
    }),
    null
  );
});

test("public map coordinates expose precise and marina-level locations conservatively", () => {
  assert.deepEqual(
    getPublicMapCoordinate({
      latitude: "5.4141123",
      longitude: "100.3288123",
      precision: "exact",
      approximate: false,
    }),
    {
      latitude: 5.41411,
      longitude: 100.32881,
      precision: "exact",
      approximate: false,
    }
  );

  assert.deepEqual(
    getPublicMapCoordinate({
      latitude: 5.4141123,
      longitude: 100.3288123,
      precision: "marina",
      approximate: false,
    }),
    {
      latitude: 5.4141,
      longitude: 100.3288,
      precision: "marina",
      approximate: false,
    }
  );
});

test("city-level map coordinates are not exposed as hard public map pins", () => {
  assert.equal(
    getPublicMapCoordinate({
      latitude: 5.4141123,
      longitude: 100.3288123,
      precision: "city",
      approximate: false,
    }),
    null
  );
});

test("map bounds parser accepts bounded viewports and rejects world-sized requests", () => {
  assert.deepEqual(parseMapBounds(new URLSearchParams("bbox=99,4,102,7")), {
    bounds: {
      west: 99,
      south: 4,
      east: 102,
      north: 7,
    },
    error: null,
  });

  assert.equal(
    parseMapBounds(new URLSearchParams("bbox=-180,-90,180,90")).error,
    "Map bounds are too large. Zoom in or filter by a location first."
  );

  assert.equal(
    parseMapBounds(new URLSearchParams("west=99&south=4&east=102")).error,
    "Provide west, south, east, and north together."
  );
});

test("map marker limit is capped for scraper resistance", () => {
  assert.equal(parseMapMarkerLimit(new URLSearchParams("limit=9999")), 500);
  assert.equal(parseMapMarkerLimit(new URLSearchParams("limit=0")), 250);
});
