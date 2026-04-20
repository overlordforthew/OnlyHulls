"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { type Map as MapLibreMap, type Marker, type Popup } from "maplibre-gl";
import { Anchor, AlertTriangle, ExternalLink, Loader2, MapPin, Navigation } from "lucide-react";
import { useTranslations } from "next-intl";
import { getPublicMapClientConfig } from "@/lib/config/public-map";
import { MAX_BOUNDS_AREA_DEGREES } from "@/lib/locations/map-bounds";
import { getInitialMapViewport } from "@/lib/locations/map-viewports";
import type { PublicMapMarker } from "@/lib/locations/public-map-markers";

type BoatsMapViewProps = {
  searchParams: string;
  locationFilter: string;
  locationLabel: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMarkerHref(slug: string) {
  return `/boats/${encodeURIComponent(slug)}`;
}

function getPrecisionLabel(precision: PublicMapMarker["precision"]) {
  if (precision === "marina") return "Marina";
  if (precision === "street") return "Street";
  return "Exact";
}

function getMarkerClassName(marker: PublicMapMarker, selected: boolean) {
  return [
    "oh-map-marker",
    `oh-map-marker-${marker.precision}`,
    selected ? "oh-map-marker-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function BoatsMapView({
  searchParams,
  locationFilter,
  locationLabel,
}: BoatsMapViewProps) {
  const t = useTranslations("boatsPage.map");
  const config = useMemo(() => getPublicMapClientConfig(), []);
  const initialViewport = useMemo(() => getInitialMapViewport(locationFilter), [locationFilter]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchParamsRef = useRef(searchParams);
  const [markers, setMarkers] = useState<PublicMapMarker[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const openMarkerPopup = useCallback((marker: PublicMapMarker) => {
    const map = mapRef.current;
    if (!map) return;

    popupRef.current?.remove();
    const wrapper = document.createElement("div");
    wrapper.className = "min-w-[190px] max-w-[240px] text-sm text-slate-950";

    const title = document.createElement("p");
    title.className = "font-semibold";
    title.textContent = marker.title;
    wrapper.appendChild(title);

    if (marker.locationText) {
      const location = document.createElement("p");
      location.className = "mt-1 text-xs text-slate-600";
      location.textContent = marker.locationText;
      wrapper.appendChild(location);
    }

    const link = document.createElement("a");
    link.href = getMarkerHref(marker.slug);
    link.className = "mt-3 inline-flex text-xs font-semibold text-sky-700 underline";
    link.textContent = t("viewListing");
    wrapper.appendChild(link);

    popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 22 })
      .setLngLat([marker.lng, marker.lat])
      .setDOMContent(wrapper)
      .addTo(map);
  }, [t]);

  const focusMarker = useCallback((marker: PublicMapMarker) => {
    const map = mapRef.current;
    setSelectedSlug(marker.slug);
    openMarkerPopup(marker);
    map?.easeTo({
      center: [marker.lng, marker.lat],
      zoom: Math.max(map.getZoom(), marker.precision === "marina" ? 11 : 10),
      duration: 420,
    });
  }, [openMarkerPopup]);

  const fetchMarkers = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !config.enabled) return;

    const bounds = map.getBounds();
    const west = clamp(bounds.getWest(), -180, 180);
    const east = clamp(bounds.getEast(), -180, 180);
    const south = clamp(bounds.getSouth(), -90, 90);
    const north = clamp(bounds.getNorth(), -90, 90);
    const area = (east - west) * (north - south);

    if (west >= east || south >= north || area > MAX_BOUNDS_AREA_DEGREES) {
      abortRef.current?.abort();
      setLoading(false);
      setHasMore(false);
      setNotice(t("zoomToLoad"));
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const params = new URLSearchParams(searchParamsRef.current);
    params.set("bbox", [west, south, east, north].map((value) => value.toFixed(5)).join(","));

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/boats/map?${params}`, { signal: controller.signal });
      if (requestId !== requestIdRef.current) return;

      if (response.status === 404) {
        setMarkers([]);
        setHasMore(false);
        setError(t("unavailable"));
        return;
      }
      if (response.status === 429) {
        setError(t("rateLimited"));
        return;
      }
      if (!response.ok) {
        setError(t("loadError"));
        return;
      }

      const payload = await response.json();
      setMarkers(Array.isArray(payload.boats) ? payload.boats : []);
      setHasMore(Boolean(payload.hasMore));
      if (payload.hasMore) {
        setNotice(t("zoomForMore"));
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(t("loadError"));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [config.enabled, t]);

  const scheduleFetch = useCallback((delay = 320) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchMarkers();
    }, delay);
  }, [fetchMarkers]);

  useEffect(() => {
    searchParamsRef.current = searchParams;
    scheduleFetch(0);
  }, [scheduleFetch, searchParams]);

  useEffect(() => {
    if (!config.enabled || !containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: config.styleUrl,
      center: [initialViewport.longitude, initialViewport.latitude],
      zoom: initialViewport.zoom,
      attributionControl: false,
      cooperativeGestures: true,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({
        compact: false,
        customAttribution: config.attribution,
      }),
      "bottom-right"
    );
    map.once("load", () => scheduleFetch(0));
    map.on("error", () => {
      if (!map.isStyleLoaded()) {
        setError(t("styleError"));
        setLoading(false);
      }
    });
    map.on("moveend", () => scheduleFetch());

    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      markersRef.current.forEach((marker) => marker.remove());
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [config.attribution, config.enabled, config.styleUrl, initialViewport, scheduleFetch, t]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = markers.map((marker) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = getMarkerClassName(marker, marker.slug === selectedSlug);
      button.setAttribute("aria-label", `${marker.title}, ${marker.locationText || t("unknownLocation")}`);
      button.addEventListener("click", () => focusMarker(marker));

      const markerInstance = new maplibregl.Marker({ element: button, anchor: "bottom" })
        .setLngLat([marker.lng, marker.lat])
        .addTo(map);

      return markerInstance;
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [focusMarker, markers, selectedSlug, t]);

  if (!config.enabled) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
        {t("disabled")}
      </div>
    );
  }

  return (
    <section
      data-testid="boats-map-shell"
      className="grid min-h-[620px] overflow-hidden rounded-lg border border-border bg-surface lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="relative min-h-[420px] bg-muted lg:min-h-[620px]">
        <div ref={containerRef} data-testid="boats-map-canvas" className="absolute inset-0" />
        <div className="pointer-events-none absolute left-4 top-4 flex max-w-[min(32rem,calc(100%-2rem))] flex-col gap-2">
          <div className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur">
            <Navigation className="h-4 w-4 text-primary" />
            {locationFilter ? t("viewportFor", { location: locationLabel }) : t("viewportDefault")}
          </div>
          {(loading || error || notice) && (
            <div className="pointer-events-auto inline-flex w-fit max-w-full items-center gap-2 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs text-text-secondary shadow-lg backdrop-blur">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
              {error ? <AlertTriangle className="h-4 w-4 text-accent" /> : null}
              <span>{loading ? t("loading") : error || notice}</span>
            </div>
          )}
        </div>
      </div>

      <aside className="flex min-h-[360px] flex-col border-t border-border bg-background/45 lg:border-l lg:border-t-0">
        <div className="border-b border-border p-4">
          <p className="text-xs font-semibold uppercase text-text-tertiary">{t("viewportInventory")}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-bold text-foreground">{markers.length}</p>
              <p className="text-xs text-text-secondary">
                {hasMore ? t("limitedCount") : t("visibleCount")}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {t("precisePins")}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {markers.length === 0 && !loading ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
              <MapPin className="h-8 w-8 text-primary" />
              <p className="mt-4 text-sm font-semibold text-foreground">{t("emptyTitle")}</p>
              <p className="mt-2 text-sm text-text-secondary">{error || t("emptyBody")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {markers.map((marker) => {
                const selected = marker.slug === selectedSlug;
                return (
                  <div
                    key={marker.slug}
                    data-testid="boats-map-listing"
                    className={`rounded-lg border p-3 transition-colors ${
                      selected
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-surface hover:border-primary/35"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => focusMarker(marker)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{marker.title}</p>
                          {marker.locationText && (
                            <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                              {marker.locationText}
                            </p>
                          )}
                        </div>
                        {marker.precision === "marina" ? (
                          <Anchor className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        )}
                      </div>
                      <p className="mt-2 text-[11px] font-semibold uppercase text-text-tertiary">
                        {getPrecisionLabel(marker.precision)}
                        {marker.approximate ? ` ${t("approximate")}` : ""}
                      </p>
                    </button>
                    <Link
                      href={getMarkerHref(marker.slug)}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-light"
                    >
                      {t("viewListing")}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}
