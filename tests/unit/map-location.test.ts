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
  assert.equal(parseMapMarkerLimit(new URLSearchParams("limit=9999")), 250);
  assert.equal(parseMapMarkerLimit(new URLSearchParams("limit=0")), 150);
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
    location_geocode_precision: "marina",
    location_approximate: false,
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
    lat: 5.4141,
    lng: 100.3288,
    precision: "marina",
    approximate: false,
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
    location_geocode_precision: "marina",
    location_approximate: false,
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
    location_geocode_precision: "marina",
    location_approximate: false,
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
      location_geocode_precision: "marina",
      location_approximate: false,
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
    location_geocode_precision: "marina",
    location_approximate: false,
  };

  assert.equal(buildPublicMapMarker({ ...base, year: null })?.title, "Lagoon 450");
  assert.equal(buildPublicMapMarker({ ...base, year: 0 })?.title, "Lagoon 450");
});
