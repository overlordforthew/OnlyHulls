export type ComparableGeocodeResult = {
  provider: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  precision: string | null;
  score: number | null;
  placeName: string | null;
  payload?: unknown;
  error?: string | null;
};

export type GeocodeComparison = {
  comparable: boolean;
  distanceKm: number | null;
  distanceBucket: "under_1km" | "under_10km" | "over_10km" | "not_comparable";
  precisionAgreement: boolean | null;
  countryAgreement: boolean | null;
  leftCountryCode: string | null;
  rightCountryCode: string | null;
};

export function hasComparableCoordinates(result: ComparableGeocodeResult) {
  return (
    result.status === "geocoded" &&
    typeof result.latitude === "number" &&
    typeof result.longitude === "number" &&
    Number.isFinite(result.latitude) &&
    Number.isFinite(result.longitude) &&
    result.latitude >= -90 &&
    result.latitude <= 90 &&
    result.longitude >= -180 &&
    result.longitude <= 180
  );
}

export function buildPinAuditUrl(latitude: number | null, longitude: number | null) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=12/${latitude}/${longitude}`;
}

export function haversineDistanceKm(
  leftLatitude: number,
  leftLongitude: number,
  rightLatitude: number,
  rightLongitude: number
) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(rightLatitude - leftLatitude);
  const deltaLng = toRadians(rightLongitude - leftLongitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(leftLatitude)) *
      Math.cos(toRadians(rightLatitude)) *
      Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function getGeocodePayloadCountryCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const address = record.address || record.components;
  if (!address || typeof address !== "object") return null;
  const countryCode = (address as Record<string, unknown>).country_code;

  return typeof countryCode === "string" ? countryCode.toLowerCase() : null;
}

export function getDistanceBucket(distanceKm: number | null): GeocodeComparison["distanceBucket"] {
  if (distanceKm === null) return "not_comparable";
  if (distanceKm < 1) return "under_1km";
  if (distanceKm < 10) return "under_10km";
  return "over_10km";
}

export function compareGeocodeResults(
  left: ComparableGeocodeResult | null,
  right: ComparableGeocodeResult | null
): GeocodeComparison {
  const leftCountryCode = getGeocodePayloadCountryCode(left?.payload);
  const rightCountryCode = getGeocodePayloadCountryCode(right?.payload);
  const comparable = Boolean(left && right && hasComparableCoordinates(left) && hasComparableCoordinates(right));
  const distanceKm = comparable
    ? haversineDistanceKm(
        left!.latitude!,
        left!.longitude!,
        right!.latitude!,
        right!.longitude!
      )
    : null;

  return {
    comparable,
    distanceKm,
    distanceBucket: getDistanceBucket(distanceKm),
    precisionAgreement:
      left && right && left.precision && right.precision ? left.precision === right.precision : null,
    countryAgreement:
      leftCountryCode && rightCountryCode ? leftCountryCode === rightCountryCode : null,
    leftCountryCode,
    rightCountryCode,
  };
}
