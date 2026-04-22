export const PUBLIC_MAP_PRECISIONS = ["city"] as const;

export type PublicMapPrecision = (typeof PUBLIC_MAP_PRECISIONS)[number];
export type LocationGeocodePrecision =
  | PublicMapPrecision
  | "region"
  | "country"
  | "unknown";

export interface PublicMapCoordinate {
  latitude: number;
  longitude: number;
  precision: PublicMapPrecision;
  approximate: boolean;
}

const PUBLIC_PRECISION_SET = new Set<string>(PUBLIC_MAP_PRECISIONS);
const COORDINATE_DECIMALS: Record<PublicMapPrecision, number> = {
  city: 2,
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeGeocodePrecision(value: unknown): LocationGeocodePrecision | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();

  return normalized === "city" ||
    normalized === "region" ||
    normalized === "country" ||
    normalized === "unknown"
    ? normalized
    : null;
}

export function isValidCoordinatePair(latitude: unknown, longitude: unknown): boolean {
  const lat = toFiniteNumber(latitude);
  const lng = toFiniteNumber(longitude);

  return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function roundCoordinate(value: number, decimals: number) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

export function getPublicMapCoordinate(input: {
  latitude: unknown;
  longitude: unknown;
  precision: unknown;
  approximate?: unknown;
}): PublicMapCoordinate | null {
  const latitude = toFiniteNumber(input.latitude);
  const longitude = toFiniteNumber(input.longitude);
  const precision = normalizeGeocodePrecision(input.precision);

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    !precision ||
    !PUBLIC_PRECISION_SET.has(precision)
  ) {
    return null;
  }

  const publicPrecision = precision as PublicMapPrecision;
  const decimals = COORDINATE_DECIMALS[publicPrecision];

  return {
    latitude: roundCoordinate(latitude, decimals),
    longitude: roundCoordinate(longitude, decimals),
    precision: publicPrecision,
    approximate: input.approximate === true,
  };
}
