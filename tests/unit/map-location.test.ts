import test from "node:test";
import assert from "node:assert/strict";

import { parseMapBounds, parseMapMarkerLimit } from "../../src/lib/locations/map-bounds";
import { getPublicMapCoordinate } from "../../src/lib/locations/map-coordinates";
import { buildPublicMapMarker } from "../../src/lib/locations/public-map-markers";

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

test("public map coordinates reject exact/street/marina precisions under the country-minimum policy", () => {
  for (const precision of ["exact", "street", "marina"] as const) {
    assert.equal(
      getPublicMapCoordinate({
        latitude: 5.4141123,
        longitude: 100.3288123,
        precision,
        approximate: false,
      }),
      null
    );
  }
});

test("city-level map coordinates are exposed as approximate area pins with coarse rounding", () => {
  assert.deepEqual(
    getPublicMapCoordinate({
      latitude: 5.4141123,
      longitude: 100.3288123,
      precision: "city",
      approximate: true,
    }),
    {
      latitude: 5.41,
      longitude: 100.33,
      precision: "city",
      approximate: true,
    }
  );
});

test("region and country precisions remain excluded from the public map", () => {
  for (const precision of ["region", "country", "unknown"] as const) {
    assert.equal(
      getPublicMapCoordinate({
        latitude: 5.4141123,
        longitude: 100.3288123,
        precision,
        approximate: true,
      }),
      null,
      `precision ${precision} should not expose a public pin`
    );
  }
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
    parseMapBounds(new URLSearchParams("bbox=-20,-20,11,10")).error,
    "Map bounds are too large. Zoom in or filter by a location first."
  );
  assert.deepEqual(parseMapBounds(new URLSearchParams("bbox=-20,-20,10,10")), {
    bounds: {
      west: -20,
      south: -20,
      east: 10,
      north: 10,
    },
    error: null,
  });

  assert.equal(
    parseMapBounds(new URLSearchParams("west=99&south=4&east=102")).error,
    "Provide west, south, east, and north together."
  );
});

test("map marker limit is capped for scraper resistance", () => {
  assert.equal(parseMapMarkerLimit(new URLSearchParams("limit=9999")), 1500);
  assert.equal(parseMapMarkerLimit(new URLSearchParams("limit=0")), 800);
  assert.equal(parseMapMarkerLimit(new URLSearchParams("limit=1")), 1);
});

test("public map markers expose only public boat identifiers and safe coordinates", () => {
  const marker = buildPublicMapMarker({
    id: "internal-boat-id",
    slug: "2015-lagoon-450-penangmalaysia",
    make: "Lagoon",
    model: "450",
    year: 2015,
    location_text: "Penang, Malaysia",
    location_lat: "5.4141123",
    location_lng: "100.3288123",
    location_geocode_precision: "city",
    location_approximate: true,
    asking_price: "495000",
    currency: "usd",
    asking_price_usd: "495000",
    hero_url: " https://cdn.example.test/boats/lagoon.jpg ",
    loa: "45.5",
  });

  assert.deepEqual(marker, {
    slug: "2015-lagoon-450-penangmalaysia",
    title: "2015 Lagoon 450",
    locationText: "Penang, Malaysia",
    lat: 5.41,
    lng: 100.33,
    precision: "city",
    approximate: true,
    askingPrice: 495000,
    currency: "USD",
    askingPriceUsd: 495000,
    heroUrl: "https://cdn.example.test/boats/lagoon.jpg",
    loa: 45.5,
  });
  assert.equal(Object.hasOwn(marker || {}, "id"), false);
  assert.deepEqual(Object.keys(marker || {}).sort(), [
    "approximate",
    "askingPrice",
    "askingPriceUsd",
    "currency",
    "heroUrl",
    "lat",
    "lng",
    "loa",
    "locationText",
    "precision",
    "slug",
    "title",
  ].sort());
});

test("public map marker commerce fields degrade safely", () => {
  const marker = buildPublicMapMarker({
    id: "internal-boat-id",
    slug: "2015-lagoon-450-penangmalaysia",
    make: "Lagoon",
    model: "450",
    year: 2015,
    location_text: "Penang, Malaysia",
    location_lat: "5.4141123",
    location_lng: "100.3288123",
    location_geocode_precision: "city",
    location_approximate: true,
    asking_price: -1,
    currency: "cad",
    asking_price_usd: 0,
    hero_url: "javascript:alert(1)",
    loa: -45,
  });

  assert.equal(marker?.askingPrice, null);
  assert.equal(marker?.currency, "USD");
  assert.equal(marker?.askingPriceUsd, null);
  assert.equal(marker?.heroUrl, null);
  assert.equal(marker?.loa, null);
});

test("public map markers allow local media URLs and reject known placeholders", () => {
  const base = {
    id: "internal-boat-id",
    slug: "2015-lagoon-450-penangmalaysia",
    make: "Lagoon",
    model: "450",
    year: 2015,
    location_text: "Penang, Malaysia",
    location_lat: "5.4141123",
    location_lng: "100.3288123",
    location_geocode_precision: "city",
    location_approximate: true,
  };

  assert.equal(
    buildPublicMapMarker({ ...base, hero_url: "/media/boats/lagoon.jpg" })?.heroUrl,
    "/media/boats/lagoon.jpg"
  );
  assert.equal(
    buildPublicMapMarker({ ...base, hero_url: "https://example.test/assets/images/noimage.jpg" })
      ?.heroUrl,
    null
  );
  assert.equal(
    buildPublicMapMarker({ ...base, hero_url: "/media/../private.jpg" })?.heroUrl,
    null
  );
  assert.equal(
    buildPublicMapMarker({ ...base, hero_url: "/media/%2e%2e/private.jpg" })?.heroUrl,
    null
  );
});

test("public map markers reject rows without a public slug", () => {
  assert.equal(
    buildPublicMapMarker({
      id: "internal-boat-id",
      slug: null,
      make: "Lagoon",
      model: "450",
      year: 2015,
      location_text: "Penang, Malaysia",
      location_lat: "5.4141123",
      location_lng: "100.3288123",
      location_geocode_precision: "city",
      location_approximate: true,
    }),
    null
  );
});

test("public map marker titles avoid missing or zero year artifacts", () => {
  const base = {
    id: "internal-boat-id",
    slug: "lagoon-450-penangmalaysia",
    make: "Lagoon",
    model: "450",
    location_text: "Penang, Malaysia",
    location_lat: "5.4141123",
    location_lng: "100.3288123",
    location_geocode_precision: "city",
    location_approximate: true,
  };

  assert.equal(buildPublicMapMarker({ ...base, year: null })?.title, "Lagoon 450");
  assert.equal(buildPublicMapMarker({ ...base, year: 0 })?.title, "Lagoon 450");
});
