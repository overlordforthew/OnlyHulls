import assert from "node:assert/strict";
import test from "node:test";
import {
  createBoatMapClusterIndex,
  getBoatMapClusterBounds,
  getBoatMapClusterItems,
  type BoatMapBounds,
} from "../../src/lib/locations/map-clusters";
import type { PublicMapMarker } from "../../src/lib/locations/public-map-markers";

function marker(slug: string, lat: number, lng: number): PublicMapMarker {
  return {
    slug,
    title: `Test boat ${slug}`,
    locationText: "Fajardo, Puerto Rico",
    lat,
    lng,
    precision: "marina",
    approximate: false,
  };
}

test("boat map clustering groups dense markets without exposing child markers", () => {
  const bounds: BoatMapBounds = [-67.5, 17.8, -65.0, 18.8];
  const index = createBoatMapClusterIndex([
    marker("one", 18.3358, -65.6319),
    marker("two", 18.3458, -65.6419),
    marker("three", 18.3658, -65.6519),
  ]);

  const clustered = getBoatMapClusterItems(index, bounds, 7);
  assert.equal(clustered.length, 1);
  assert.equal(clustered[0].kind, "cluster");
  if (clustered[0].kind !== "cluster") throw new Error("expected a cluster");

  assert.equal(clustered[0].count, 3);
  assert.deepEqual(
    getBoatMapClusterBounds(index, clustered[0].id, clustered[0].lng, clustered[0].lat),
    [-65.6519, 18.3358, -65.6319, 18.3658]
  );

  const expanded = getBoatMapClusterItems(index, bounds, clustered[0].expansionZoom);
  assert.ok(expanded.length > 1);
});

test("boat map clustering leaves sparse markers as regular public markers", () => {
  const bounds: BoatMapBounds = [-90, 15, -60, 35];
  const index = createBoatMapClusterIndex([
    marker("puerto-rico", 18.3358, -65.6319),
    marker("florida", 26.7500, -80.0500),
  ]);

  const items = getBoatMapClusterItems(index, bounds, 7);
  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((item) => item.kind),
    ["marker", "marker"]
  );
});
