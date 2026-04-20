import { buildBoatDisplayTitle } from "@/lib/boats/detail-display";
import { sanitizeImportedBoatRecord } from "@/lib/import-quality";
import { getPublicMapCoordinate } from "@/lib/locations/map-coordinates";
import { isLocalMediaUrl } from "@/lib/media";
import { getSafeExternalUrl, isKnownPlaceholderImageUrl } from "@/lib/url-safety";

export type PublicMapBoatRow = {
  id?: string | null;
  slug: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  location_text: string | null;
  location_lat: number | string | null;
  location_lng: number | string | null;
  location_geocode_precision: string | null;
  location_approximate: boolean | null;
  asking_price?: number | string | null;
  currency?: string | null;
  asking_price_usd?: number | string | null;
  hero_url?: string | null;
  loa?: number | string | null;
};

const PUBLIC_MAP_CURRENCIES = new Set(["USD", "EUR", "GBP"]);

function toPositiveFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeCurrency(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase();
  return PUBLIC_MAP_CURRENCIES.has(normalized) ? normalized : "USD";
}

function getSafeLocalMediaUrl(value: string) {
  if (!isLocalMediaUrl(value) || value.includes("?") || value.includes("#")) return null;

  try {
    const mediaPath = decodeURIComponent(value).replace(/^\/media\/?/, "");
    const segments = mediaPath
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (
      segments.length === 0 ||
      segments.some((segment) => segment === "." || segment === "..")
    ) {
      return null;
    }

    return `/media/${segments.join("/")}`;
  } catch {
    return null;
  }
}

function getSafePublicHeroUrl(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized || isKnownPlaceholderImageUrl(normalized)) return null;
  if (isLocalMediaUrl(normalized)) return getSafeLocalMediaUrl(normalized);
  return getSafeExternalUrl(normalized);
}

export function buildPublicMapMarker(row: PublicMapBoatRow) {
  const publicCoordinate = getPublicMapCoordinate({
    latitude: row.location_lat,
    longitude: row.location_lng,
    precision: row.location_geocode_precision,
    approximate: row.location_approximate,
  });

  if (!publicCoordinate || !row.slug) return null;

  const normalized = sanitizeImportedBoatRecord({
    year: row.year,
    slug: row.slug,
    make: row.make || "",
    model: row.model || "",
    location_text: row.location_text,
    source_site: null,
    specs: {},
  });
  const askingPrice = toPositiveFiniteNumber(row.asking_price);

  return {
    slug: row.slug,
    title: buildBoatDisplayTitle({
      year: row.year,
      make: normalized.make,
      model: normalized.model,
    }),
    locationText: normalized.location_text,
    lat: publicCoordinate.latitude,
    lng: publicCoordinate.longitude,
    precision: publicCoordinate.precision,
    approximate: publicCoordinate.approximate,
    askingPrice,
    currency: normalizeCurrency(row.currency),
    askingPriceUsd: toPositiveFiniteNumber(row.asking_price_usd),
    heroUrl: getSafePublicHeroUrl(row.hero_url),
    loa: toPositiveFiniteNumber(row.loa),
  };
}

export type PublicMapMarker = NonNullable<ReturnType<typeof buildPublicMapMarker>>;
