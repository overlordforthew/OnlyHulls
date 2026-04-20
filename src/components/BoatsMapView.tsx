"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { type Map as MapLibreMap, type Marker, type Popup } from "maplibre-gl";
import {
  Anchor,
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { getPublicMapClientConfig } from "@/lib/config/public-map";
import { MAX_BOUNDS_AREA_DEGREES } from "@/lib/locations/map-bounds";
import {
  hasMapViewportParams,
  MAP_VIEW_PARAM,
  MAP_VIEW_VALUE,
  stripMapViewportParams,
} from "@/lib/locations/map-url-state";
import type { MapInitialViewport } from "@/lib/locations/map-viewports";
import type { PublicMapMarker } from "@/lib/locations/public-map-markers";

type BoatsMapViewProps = {
  searchParams: string;
  locationFilter: string;
  locationLabel: string;
  initialViewport: MapInitialViewport;
  homeViewport: MapInitialViewport;
  urlViewport: MapInitialViewport | null;
  onViewportChange: (viewport: MapInitialViewport) => void;
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

function getCurrentViewport(map: MapLibreMap): MapInitialViewport {
  const center = map.getCenter();
  return {
    latitude: center.lat,
    longitude: center.lng,
    zoom: map.getZoom(),
  };
}

function isSameViewport(left: MapInitialViewport, right: MapInitialViewport) {
  return (
    Math.abs(left.latitude - right.latitude) < 0.00001 &&
    Math.abs(left.longitude - right.longitude) < 0.00001 &&
    Math.abs(left.zoom - right.zoom) < 0.01
  );
}

function fallbackCopyText(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy command failed");
}

export default function BoatsMapView({
  searchParams,
  locationFilter,
  locationLabel,
  initialViewport,
  homeViewport,
  urlViewport,
  onViewportChange,
}: BoatsMapViewProps) {
  const t = useTranslations("boatsPage.map");
  const config = useMemo(() => getPublicMapClientConfig(), []);
  const initialViewportRef = useRef(initialViewport);
  const homeViewportRef = useRef(homeViewport);
  const urlViewportRef = useRef(urlViewport);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapReadyRef = useRef(false);
  const popupRef = useRef<Popup | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticMoveRef = useRef(false);
  const programmaticMoveIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const searchParamsRef = useRef(searchParams);
  const [markers, setMarkers] = useState<PublicMapMarker[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [currentViewport, setCurrentViewport] = useState<MapInitialViewport | null>(null);
  const [hasViewportParams, setHasViewportParams] = useState(() =>
    typeof window === "undefined"
      ? false
      : hasMapViewportParams(new URLSearchParams(window.location.search))
  );
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copyStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!map || !config.enabled || !mapReadyRef.current) return;

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

  const clearViewportDebounce = useCallback(() => {
    if (viewportDebounceRef.current) {
      clearTimeout(viewportDebounceRef.current);
      viewportDebounceRef.current = null;
    }
  }, []);

  const beginProgrammaticMove = useCallback((map: MapLibreMap) => {
    clearViewportDebounce();
    const moveId = programmaticMoveIdRef.current + 1;
    programmaticMoveIdRef.current = moveId;
    programmaticMoveRef.current = true;

    const releaseProgrammaticMove = () => {
      if (programmaticMoveIdRef.current === moveId) {
        programmaticMoveRef.current = false;
      }
    };

    map.once("moveend", () => {
      window.setTimeout(releaseProgrammaticMove, 0);
    });
    window.setTimeout(releaseProgrammaticMove, 1000);
  }, [clearViewportDebounce]);

  const stripViewportFromCurrentUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.set(MAP_VIEW_PARAM, MAP_VIEW_VALUE);
    stripMapViewportParams(params);
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
    setHasViewportParams(false);
  }, []);

  const flushPendingViewportWrite = useCallback(() => {
    if (!viewportDebounceRef.current) return;
    const map = mapRef.current;
    clearViewportDebounce();
    if (!map || programmaticMoveRef.current) return;

    onViewportChange(getCurrentViewport(map));
    setHasViewportParams(true);
  }, [clearViewportDebounce, onViewportChange]);

  const scheduleViewportWrite = useCallback((delay = 250) => {
    clearViewportDebounce();
    const map = mapRef.current;
    if (!map || programmaticMoveRef.current) return;

    viewportDebounceRef.current = setTimeout(() => {
      const activeMap = mapRef.current;
      if (!activeMap || programmaticMoveRef.current) return;
      onViewportChange(getCurrentViewport(activeMap));
      setHasViewportParams(true);
    }, delay);
  }, [clearViewportDebounce, onViewportChange]);

  const resetCopyStatus = useCallback((status: "copied" | "failed") => {
    setCopyStatus(status);
    if (copyStatusTimeoutRef.current) clearTimeout(copyStatusTimeoutRef.current);
    copyStatusTimeoutRef.current = setTimeout(() => setCopyStatus("idle"), 2000);
  }, []);

  const handleCopyMapLink = useCallback(async () => {
    try {
      flushPendingViewportWrite();
      const href = window.location.href;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(href);
      } else {
        fallbackCopyText(href);
      }
      resetCopyStatus("copied");
    } catch {
      try {
        fallbackCopyText(window.location.href);
        resetCopyStatus("copied");
      } catch {
        resetCopyStatus("failed");
      }
    }
  }, [flushPendingViewportWrite, resetCopyStatus]);

  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const viewport = homeViewportRef.current;
    map.stop();
    stripViewportFromCurrentUrl();
    setCurrentViewport(viewport);
    beginProgrammaticMove(map);
    map.easeTo({
      center: [viewport.longitude, viewport.latitude],
      zoom: viewport.zoom,
      duration: 420,
    });
  }, [beginProgrammaticMove, mapReady, stripViewportFromCurrentUrl]);

  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const viewport = homeViewportRef.current;
    map.stop();
    stripViewportFromCurrentUrl();
    setCurrentViewport(viewport);

    beginProgrammaticMove(map);
    map.jumpTo({
      center: [viewport.longitude, viewport.latitude],
      zoom: viewport.zoom,
    });
    scheduleFetch(0);
  }, [beginProgrammaticMove, mapReady, scheduleFetch, stripViewportFromCurrentUrl]);

  useEffect(() => {
    searchParamsRef.current = searchParams;
    scheduleFetch(0);
  }, [scheduleFetch, searchParams]);

  useEffect(() => {
    urlViewportRef.current = urlViewport;
    setHasViewportParams(hasMapViewportParams(new URLSearchParams(window.location.search)));
  }, [urlViewport]);

  useEffect(() => {
    homeViewportRef.current = homeViewport;
  }, [homeViewport]);

  useEffect(() => {
    if (!config.enabled || !containerRef.current || mapRef.current) return;

    const mountViewport = initialViewportRef.current;
    mapReadyRef.current = false;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: config.styleUrl,
      center: [mountViewport.longitude, mountViewport.latitude],
      zoom: mountViewport.zoom,
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
    map.once("load", () => {
      mapReadyRef.current = true;
      setMapReady(true);
      setCurrentViewport(getCurrentViewport(map));
      scheduleFetch(0);
      const activeUrlViewport = urlViewportRef.current;
      if (!activeUrlViewport || !isSameViewport(getCurrentViewport(map), activeUrlViewport)) {
        scheduleViewportWrite(0);
      }
    });
    map.on("error", () => {
      if (!map.isStyleLoaded()) {
        setError(t("styleError"));
        setLoading(false);
      }
    });
    map.on("moveend", () => {
      setCurrentViewport(getCurrentViewport(map));
      scheduleFetch();
      scheduleViewportWrite();
    });

    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
      if (copyStatusTimeoutRef.current) clearTimeout(copyStatusTimeoutRef.current);
      markersRef.current.forEach((marker) => marker.remove());
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
      setMapReady(false);
    };
  }, [
    config.attribution,
    config.enabled,
    config.styleUrl,
    scheduleFetch,
    scheduleViewportWrite,
    t,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !urlViewport) return;
    const currentViewport = getCurrentViewport(map);
    if (isSameViewport(currentViewport, urlViewport)) return;

    map.stop();
    beginProgrammaticMove(map);
    map.jumpTo({
      center: [urlViewport.longitude, urlViewport.latitude],
      zoom: urlViewport.zoom,
    });
    setCurrentViewport(urlViewport);
    scheduleFetch(0);
  }, [beginProgrammaticMove, scheduleFetch, urlViewport]);

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

  const canRecenter = Boolean(
    mapReady &&
      currentViewport &&
      !isSameViewport(currentViewport, homeViewport)
  );

  return (
    <section
      data-testid="boats-map-shell"
      className="grid min-h-[620px] overflow-hidden rounded-lg border border-border bg-surface lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="relative min-h-[420px] bg-muted lg:min-h-[620px]">
        <div className="absolute inset-0">
          <div ref={containerRef} data-testid="boats-map-canvas" className="h-full w-full" />
        </div>
        <div className="pointer-events-none absolute left-4 top-4 flex max-w-[min(32rem,calc(100%-2rem))] flex-col gap-2">
          <div className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur">
            <Navigation className="h-4 w-4 text-primary" />
            {locationFilter ? t("viewportFor", { location: locationLabel }) : t("viewportDefault")}
          </div>
          <div className="pointer-events-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-background/90 p-2 text-xs text-foreground shadow-lg backdrop-blur">
            <button
              type="button"
              data-testid="boats-map-copy-link"
              onClick={handleCopyMapLink}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-semibold transition-colors hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Copy className="h-3.5 w-3.5" />
              {t("copyLink")}
            </button>
            <button
              type="button"
              data-testid="boats-map-recenter"
              onClick={handleRecenter}
              disabled={!canRecenter}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-semibold transition-colors hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              {locationFilter ? t("recenterOn", { location: locationLabel }) : t("recenter")}
            </button>
            <button
              type="button"
              data-testid="boats-map-reset-view"
              onClick={handleResetView}
              disabled={!mapReady || !hasViewportParams}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-semibold transition-colors hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("resetView")}
            </button>
          </div>
          <div role="status" aria-live="polite" aria-atomic="true">
            {copyStatus !== "idle" ? (
              <div className="pointer-events-auto inline-flex w-fit rounded-lg border border-border bg-background/90 px-3 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur">
                {copyStatus === "copied" ? t("copySuccess") : t("copyFailed")}
              </div>
            ) : null}
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
