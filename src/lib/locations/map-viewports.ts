import { canonicalizeLocationParam } from "@/lib/locations/top-markets";

export type MapInitialViewport = {
  latitude: number;
  longitude: number;
  zoom: number;
};

const DEFAULT_MAP_VIEWPORT: MapInitialViewport = {
  latitude: 20.5,
  longitude: -69.5,
  zoom: 5.2,
};

const LOCATION_MAP_VIEWPORTS: Record<string, MapInitialViewport> = {
  bahamas: { latitude: 24.7, longitude: -76.2, zoom: 5.7 },
  bvi: { latitude: 18.45, longitude: -64.55, zoom: 8.1 },
  caribbean: { latitude: 18.3, longitude: -66.1, zoom: 5.1 },
  europe: { latitude: 43.7, longitude: 9.4, zoom: 4.5 },
  florida: { latitude: 26.4, longitude: -80.4, zoom: 6.1 },
  france: { latitude: 43.3, longitude: 5.4, zoom: 5.8 },
  greece: { latitude: 37.9, longitude: 23.9, zoom: 6 },
  italy: { latitude: 41.2, longitude: 12.9, zoom: 5.5 },
  malaysia: { latitude: 4.9, longitude: 102.2, zoom: 5.1 },
  mediterranean: { latitude: 39.4, longitude: 12.5, zoom: 4.6 },
  mexico: { latitude: 20.6, longitude: -87.1, zoom: 5.6 },
  panama: { latitude: 8.9, longitude: -79.8, zoom: 6.4 },
  "puerto-rico": { latitude: 18.25, longitude: -66.45, zoom: 8 },
  spain: { latitude: 39.8, longitude: 2.9, zoom: 5.2 },
  thailand: { latitude: 8.1, longitude: 98.6, zoom: 6.1 },
  "united-states": { latitude: 27.6, longitude: -82.2, zoom: 5 },
  usvi: { latitude: 18.05, longitude: -64.85, zoom: 8.2 },
};

export function getInitialMapViewport(location?: string | null): MapInitialViewport {
  const slug = canonicalizeLocationParam(location);
  return (slug && LOCATION_MAP_VIEWPORTS[slug]) || DEFAULT_MAP_VIEWPORT;
}
