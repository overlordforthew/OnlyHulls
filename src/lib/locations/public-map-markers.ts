import { buildBoatDisplayTitle } from "@/lib/boats/detail-display";
import { sanitizeImportedBoatRecord } from "@/lib/import-quality";
import { getPublicMapCoordinate } from "@/lib/locations/map-coordinates";

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
};

export function buildPublicMapMarker(row: PublicMapBoatRow) {
  const publicCoordinate = getPublicMapCoordinate({
    latitude: row.location_lat,
    longitude: row.location_lng,
    precision: row.location_geocode_precision,
    approximate: row.location_approximate,
  });

  if (!publicCoordinate || !row.slug) return null;

  const normalized = sanitizeImportedBoatRecord({
    ...row,
    make: row.make || "",
    model: row.model || "",
    source_site: null,
    specs: {},
  });

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
  };
}
