import Supercluster from "supercluster";
import type { PublicMapMarker } from "@/lib/locations/public-map-markers";

export type BoatMapBounds = [west: number, south: number, east: number, north: number];

type BoatMapPointProperties = {
  marker: PublicMapMarker;
};

type BoatMapClusterProperties = Record<string, never>;

export type BoatMapClusterIndex = Supercluster<BoatMapPointProperties, BoatMapClusterProperties>;

export type BoatMapClusterItem =
  | {
      kind: "cluster";
      id: number;
      count: number;
      label: string;
      lat: number;
      lng: number;
      expansionZoom: number;
    }
  | {
      kind: "marker";
      marker: PublicMapMarker;
      lat: number;
      lng: number;
    };

function isClusterFeature(
  feature:
    | Supercluster.ClusterFeature<BoatMapClusterProperties>
    | Supercluster.PointFeature<BoatMapPointProperties>
): feature is Supercluster.ClusterFeature<BoatMapClusterProperties> {
  return Boolean((feature.properties as Supercluster.ClusterProperties).cluster);
}

export function getBoatMapClusterBounds(
  index: BoatMapClusterIndex,
  clusterId: number,
  fallbackLng: number,
  fallbackLat: number
): BoatMapBounds {
  const leaves = index.getLeaves(clusterId, Infinity);
  if (leaves.length === 0) return [fallbackLng, fallbackLat, fallbackLng, fallbackLat];

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const leaf of leaves) {
    const [lng, lat] = leaf.geometry.coordinates;
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }

  return [west, south, east, north];
}

export function createBoatMapClusterIndex(markers: PublicMapMarker[]) {
  const index = new Supercluster<BoatMapPointProperties, BoatMapClusterProperties>({
    radius: 56,
    maxZoom: 14,
    minPoints: 2,
  });

  index.load(
    markers.map((marker) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [marker.lng, marker.lat],
      },
      properties: { marker },
    }))
  );

  return index;
}

export function getBoatMapClusterItems(
  index: BoatMapClusterIndex,
  bounds: BoatMapBounds,
  zoom: number
): BoatMapClusterItem[] {
  return index.getClusters(bounds, Math.floor(zoom)).map((feature) => {
    const [lng, lat] = feature.geometry.coordinates;

    if (!isClusterFeature(feature)) {
      return {
        kind: "marker",
        marker: feature.properties.marker,
        lat,
        lng,
      };
    }

    const clusterId = feature.properties.cluster_id;
    return {
      kind: "cluster",
      id: clusterId,
      count: feature.properties.point_count,
      label: String(feature.properties.point_count_abbreviated),
      lat,
      lng,
      expansionZoom: index.getClusterExpansionZoom(clusterId),
    };
  });
}
