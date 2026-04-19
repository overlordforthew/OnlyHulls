import type { BoatSearchFilters } from "@/lib/search/boat-search";

export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export const MAP_MARKER_DEFAULT_LIMIT = 250;
export const MAP_MARKER_MAX_LIMIT = 500;
export const MAX_BOUNDS_AREA_DEGREES = 2500;

type MapBoundsParseResult =
  | { bounds: MapBounds | null; error: null }
  | { bounds: null; error: string };

function parseNumber(value: string | null): number | null {
  if (value === null || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateBounds(bounds: MapBounds): string | null {
  if (
    bounds.west < -180 ||
    bounds.west > 180 ||
    bounds.east < -180 ||
    bounds.east > 180 ||
    bounds.south < -90 ||
    bounds.south > 90 ||
    bounds.north < -90 ||
    bounds.north > 90
  ) {
    return "Map bounds are outside valid latitude/longitude ranges.";
  }

  if (bounds.west >= bounds.east || bounds.south >= bounds.north) {
    return "Map bounds must use west,south,east,north order.";
  }

  const area = (bounds.east - bounds.west) * (bounds.north - bounds.south);
  if (area > MAX_BOUNDS_AREA_DEGREES) {
    return "Map bounds are too large. Zoom in or filter by a location first.";
  }

  return null;
}

export function parseMapBounds(searchParams: URLSearchParams): MapBoundsParseResult {
  const bbox = searchParams.get("bbox");
  if (bbox) {
    const values = bbox.split(",").map((value) => parseNumber(value));
    if (values.length !== 4 || values.some((value) => value === null)) {
      return { bounds: null, error: "Use bbox=west,south,east,north." };
    }

    const [west, south, east, north] = values as [number, number, number, number];
    const bounds = { west, south, east, north };
    const error = validateBounds(bounds);

    return error ? { bounds: null, error } : { bounds, error: null };
  }

  const west = parseNumber(searchParams.get("west"));
  const south = parseNumber(searchParams.get("south"));
  const east = parseNumber(searchParams.get("east"));
  const north = parseNumber(searchParams.get("north"));
  const providedCount = [west, south, east, north].filter((value) => value !== null).length;

  if (providedCount === 0) {
    return { bounds: null, error: null };
  }
  if (providedCount !== 4) {
    return { bounds: null, error: "Provide west, south, east, and north together." };
  }

  const bounds = {
    west: west as number,
    south: south as number,
    east: east as number,
    north: north as number,
  };
  const error = validateBounds(bounds);

  return error ? { bounds: null, error } : { bounds, error: null };
}

export function parseMapMarkerLimit(searchParams: URLSearchParams): number {
  const requested = Number(searchParams.get("limit") || MAP_MARKER_DEFAULT_LIMIT);
  if (!Number.isFinite(requested) || requested < 1) return MAP_MARKER_DEFAULT_LIMIT;

  return Math.min(Math.floor(requested), MAP_MARKER_MAX_LIMIT);
}

export function hasMapScope(filters: BoatSearchFilters, bounds: MapBounds | null): boolean {
  return Boolean(
    bounds ||
      filters.location ||
      filters.search ||
      filters.tag ||
      filters.rigType ||
      filters.hullType ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.minYear ||
      filters.maxYear
  );
}
