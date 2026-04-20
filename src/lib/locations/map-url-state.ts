import type { MapInitialViewport } from "@/lib/locations/map-viewports";

export const MAP_VIEW_PARAM = "view";
export const MAP_CENTER_PARAM = "mapCenter";
export const MAP_ZOOM_PARAM = "mapZoom";
export const MAP_VIEW_VALUE = "map";
export const MAP_MIN_ZOOM = 2;
export const MAP_MAX_ZOOM = 14;

type SearchParamReader = {
  get(key: string): string | null;
};

function parseFiniteNumber(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals: number) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

export function parseMapViewportFromParams(params: SearchParamReader): MapInitialViewport | null {
  const center = params.get(MAP_CENTER_PARAM);
  const zoom = parseFiniteNumber(params.get(MAP_ZOOM_PARAM));
  if (!center || zoom === null || zoom < MAP_MIN_ZOOM || zoom > MAP_MAX_ZOOM) return null;

  const [latRaw, lngRaw, extra] = center.split(",");
  if (extra !== undefined) return null;

  const latitude = parseFiniteNumber(latRaw);
  const longitude = parseFiniteNumber(lngRaw);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    zoom,
  };
}

export function wantsMapView(params: SearchParamReader) {
  return params.get(MAP_VIEW_PARAM) === MAP_VIEW_VALUE;
}

export function stripMapUrlParams(params: URLSearchParams) {
  params.delete(MAP_VIEW_PARAM);
  params.delete(MAP_CENTER_PARAM);
  params.delete(MAP_ZOOM_PARAM);
  return params;
}

export function setMapUrlParams(params: URLSearchParams, viewport: MapInitialViewport) {
  params.set(MAP_VIEW_PARAM, MAP_VIEW_VALUE);
  params.set(
    MAP_CENTER_PARAM,
    `${round(viewport.latitude, 5).toFixed(5)},${round(viewport.longitude, 5).toFixed(5)}`
  );
  params.set(MAP_ZOOM_PARAM, round(viewport.zoom, 2).toFixed(2));
  return params;
}
