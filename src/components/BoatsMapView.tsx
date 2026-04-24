"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { type Map as MapLibreMap, type Marker, type Popup } from "maplibre-gl";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  ImageIcon,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Ruler,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { getPublicMapClientConfig } from "@/lib/config/public-map";
import { getDisplayedPrice, type SupportedCurrency } from "@/lib/currency";
import {
  createBoatMapClusterIndex,
  getBoatMapClusterBounds,
  getBoatMapClusterItems,
  type BoatMapBounds,
  type BoatMapClusterItem,
} from "@/lib/locations/map-clusters";
import { MAX_BOUNDS_AREA_DEGREES } from "@/lib/locations/map-bounds";
import {
  hasMapViewportParams,
  hasMapViewportDrifted,
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
  displayCurrency?: SupportedCurrency;
  onViewportChange: (viewport: MapInitialViewport) => void;
  // True when any search scope is active (location, query, tag, or applied
  // filters). When true we skip the geolocation override so filter-scoped
  // views keep their global viewport and don't empty the map for users
  // browsing outside a boat region.
  hasSearchScope: boolean;
  onMapUnavailable?: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMarkerHref(slug: string) {
  return `/boats/${encodeURIComponent(slug)}`;
}

// Precision tier now collapses to a single bucket (public map only serves
// `city`-grade pins per PUBLIC_MAP_PRECISIONS), so these helpers don't need
// the marker argument. Leaving the call sites unchanged so a future tier
// re-expansion stays a one-line swap.
function getPrecisionLabel() {
  return "City area";
}

function getPrecisionZoomTarget() {
  return 8;
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

function formatLoa(loa: number | null) {
  if (loa === null) return null;
  const rounded = Number.isInteger(loa) ? String(loa) : loa.toFixed(1).replace(/\.0$/, "");
  return `${rounded} ft`;
}

function getMapMarkerPrice(marker: PublicMapMarker, displayCurrency?: SupportedCurrency) {
  if (marker.askingPrice === null) return null;

  return getDisplayedPrice({
    amount: marker.askingPrice,
    nativeCurrency: marker.currency,
    amountUsd: marker.askingPriceUsd,
    preferredCurrency: displayCurrency,
  });
}

function getCurrentViewport(map: MapLibreMap): MapInitialViewport {
  const center = map.getCenter();
  return {
    latitude: center.lat,
    longitude: center.lng,
    zoom: map.getZoom(),
  };
}

function getCurrentBounds(map: MapLibreMap): BoatMapBounds {
  const bounds = map.getBounds();
  return [
    clamp(bounds.getWest(), -180, 180),
    clamp(bounds.getSouth(), -90, 90),
    clamp(bounds.getEast(), -180, 180),
    clamp(bounds.getNorth(), -90, 90),
  ];
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
  displayCurrency,
  onViewportChange,
  hasSearchScope,
  onMapUnavailable,
}: BoatsMapViewProps) {
  const t = useTranslations("boatsPage.map");
  const config = useMemo(() => getPublicMapClientConfig(), []);
  const initialViewportRef = useRef(initialViewport);
  const homeViewportRef = useRef(homeViewport);
  const urlViewportRef = useRef(urlViewport);
  const locationFilterRef = useRef(locationFilter);
  const hasSearchScopeRef = useRef(hasSearchScope);
  const onMapUnavailableRef = useRef(onMapUnavailable);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
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
  const lastFetchedViewportRef = useRef<MapInitialViewport | null>(null);
  const searchParamsRef = useRef(searchParams);
  const listingRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const markerElementsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const selectedSlugRef = useRef<string | null>(null);
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const [markers, setMarkers] = useState<PublicMapMarker[]>([]);
  const [clusterViewport, setClusterViewport] = useState<{
    bounds: BoatMapBounds;
    key: string;
    zoom: number;
  } | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [hasStaleViewport, setHasStaleViewport] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [currentViewport, setCurrentViewport] = useState<MapInitialViewport | null>(null);
  const [hasViewportParams, setHasViewportParams] = useState(() =>
    typeof window === "undefined"
      ? false
      : hasMapViewportParams(new URLSearchParams(window.location.search))
  );
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copyStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clusterIndex = useMemo(() => createBoatMapClusterIndex(markers), [markers]);
  const clusterItems = useMemo(
    () =>
      clusterViewport
        ? getBoatMapClusterItems(clusterIndex, clusterViewport.bounds, clusterViewport.zoom)
        : [],
    [clusterIndex, clusterViewport]
  );

  const scrollListingIntoView = useCallback((slug: string) => {
    const container = sidebarScrollRef.current;
    const row = listingRefs.current.get(slug);
    if (!container || !row) return;

    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const rowTop = rowRect.top - containerRect.top + container.scrollTop;
    const rowBottom = rowRect.bottom - containerRect.top + container.scrollTop;
    const visibleTop = container.scrollTop;
    const visibleBottom = visibleTop + container.clientHeight;
    const padding = 12;

    if (rowTop < visibleTop + padding) {
      container.scrollTo({ top: Math.max(rowTop - padding, 0), behavior: "smooth" });
      return;
    }

    if (rowBottom > visibleBottom - padding) {
      container.scrollTo({
        top: rowBottom - container.clientHeight + padding,
        behavior: "smooth",
      });
    }
  }, []);

  const openMarkerPopup = useCallback((marker: PublicMapMarker) => {
    const map = mapRef.current;
    if (!map) return;

    popupRef.current?.remove();
    const wrapper = document.createElement("div");
    wrapper.className = "min-w-[230px] max-w-[280px] text-sm text-slate-950";
    wrapper.setAttribute("data-testid", "boats-map-popup");

    if (marker.heroUrl) {
      const image = document.createElement("img");
      image.src = marker.heroUrl;
      image.alt = marker.title;
      image.loading = "lazy";
      image.decoding = "async";
      image.className = "mb-3 h-32 w-full rounded-md object-cover";
      image.setAttribute("data-testid", "boats-map-popup-image");
      wrapper.appendChild(image);
    } else {
      const fallback = document.createElement("div");
      fallback.className =
        "mb-3 flex h-24 w-full items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500";
      fallback.textContent = t("photoFallback");
      wrapper.appendChild(fallback);
    }

    const displayedPrice = getMapMarkerPrice(marker, displayCurrency);
    const price = document.createElement("p");
    price.className = "font-bold text-slate-950";
    price.setAttribute("data-testid", "boats-map-popup-price");
    price.textContent = displayedPrice?.primary || t("priceUnavailable");
    wrapper.appendChild(price);

    if (displayedPrice?.secondary) {
      const secondary = document.createElement("p");
      secondary.className = "mt-0.5 text-[11px] text-slate-500";
      secondary.textContent = displayedPrice.secondary;
      wrapper.appendChild(secondary);
    }

    const title = document.createElement("p");
    title.className = "mt-2 font-semibold";
    title.textContent = marker.title;
    wrapper.appendChild(title);

    if (marker.locationText) {
      const location = document.createElement("p");
      location.className = "mt-1 text-xs text-slate-600";
      location.textContent = marker.locationText;
      wrapper.appendChild(location);
    }

    const loa = formatLoa(marker.loa);
    if (loa) {
      const specs = document.createElement("p");
      specs.className = "mt-2 text-[11px] font-semibold uppercase text-slate-500";
      specs.textContent = loa;
      wrapper.appendChild(specs);
    }

    const link = document.createElement("a");
    link.href = getMarkerHref(marker.slug);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "mt-3 inline-flex text-xs font-semibold text-sky-700 underline";
    link.textContent = t("viewListing");
    wrapper.appendChild(link);

    const popup = new maplibregl.Popup({ closeButton: true, offset: 22 })
      .setLngLat([marker.lng, marker.lat])
      .setDOMContent(wrapper)
      .addTo(map);
    popup.on("close", () => {
      if (popupRef.current === popup) {
        popupRef.current = null;
        setSelectedSlug(null);
      }
    });
    popupRef.current = popup;
  }, [displayCurrency, t]);

  const focusMarker = useCallback((marker: PublicMapMarker, options?: {
    recenter?: boolean;
    scrollListing?: boolean;
  }) => {
    const map = mapRef.current;
    openMarkerPopup(marker);
    setSelectedSlug(marker.slug);
    if (options?.scrollListing) {
      scrollListingIntoView(marker.slug);
    }

    if (options?.recenter === false) return;

    map?.easeTo({
      center: [marker.lng, marker.lat],
      zoom: Math.max(map.getZoom(), getPrecisionZoomTarget()),
      duration: 420,
    });
  }, [openMarkerPopup, scrollListingIntoView]);

  const syncClusterViewport = useCallback((map: MapLibreMap) => {
    const bounds = getCurrentBounds(map);
    const zoom = map.getZoom();
    const key = `${Math.floor(zoom)}:${bounds.map((value) => value.toFixed(4)).join(",")}`;

    setClusterViewport((current) => {
      if (current?.key === key) return current;
      return { bounds, key, zoom };
    });
  }, []);

  const expandCluster = useCallback((cluster: Extract<BoatMapClusterItem, { kind: "cluster" }>) => {
    const map = mapRef.current;
    if (!map) return;

    popupRef.current?.remove();
    setSelectedSlug(null);
    const [west, south, east, north] = getBoatMapClusterBounds(
      clusterIndex,
      cluster.id,
      cluster.lng,
      cluster.lat
    );
    const nextZoom = Math.min(cluster.expansionZoom, map.getMaxZoom());

    if (west === east && south === north) {
      map.easeTo({
        center: [cluster.lng, cluster.lat],
        zoom: Math.min(map.getMaxZoom(), Math.max(map.getZoom() + 1, nextZoom)),
        duration: 420,
      });
      return;
    }

    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      {
        padding: 72,
        maxZoom: nextZoom,
        duration: 420,
      }
    );
  }, [clusterIndex]);

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

    const requestViewport = getCurrentViewport(map);
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
        lastFetchedViewportRef.current = requestViewport;
        setHasStaleViewport(hasMapViewportDrifted(requestViewport, getCurrentViewport(map)));
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
      lastFetchedViewportRef.current = requestViewport;
      setHasStaleViewport(hasMapViewportDrifted(requestViewport, getCurrentViewport(map)));
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
    map.once("moveend", () => scheduleFetch(0));
    map.easeTo({
      center: [viewport.longitude, viewport.latitude],
      zoom: viewport.zoom,
      duration: 420,
    });
  }, [beginProgrammaticMove, mapReady, scheduleFetch, stripViewportFromCurrentUrl]);

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

  const handleSearchArea = useCallback(() => {
    if (!mapReady || loading) return;

    flushPendingViewportWrite();
    scheduleFetch(0);
  }, [flushPendingViewportWrite, loading, mapReady, scheduleFetch]);

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
    locationFilterRef.current = locationFilter;
  }, [locationFilter]);

  useEffect(() => {
    hasSearchScopeRef.current = hasSearchScope;
  }, [hasSearchScope]);

  useEffect(() => {
    onMapUnavailableRef.current = onMapUnavailable;
  }, [onMapUnavailable]);

  useEffect(() => {
    selectedSlugRef.current = selectedSlug;
    markerElementsRef.current.forEach((button, slug) => {
      const selected = slug === selectedSlug;
      button.classList.toggle("oh-map-marker-selected", selected);
      button.setAttribute("data-selected", selected ? "true" : "false");
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }, [selectedSlug]);

  useEffect(() => {
    if (!config.enabled || !containerRef.current || mapRef.current) return;

    const mountViewport = initialViewportRef.current;
    mapReadyRef.current = false;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: config.styleUrl,
        center: [mountViewport.longitude, mountViewport.latitude],
        zoom: mountViewport.zoom,
        attributionControl: false,
        cooperativeGestures: true,
      });
    } catch (err) {
      // MapLibre throws synchronously when the browser can't create a WebGL
      // context (old devices, privacy-hardened browsers, some headless envs).
      // Fail gracefully to a text fallback instead of letting the throw unwind
      // to the public layout's error boundary.
      console.warn("BoatsMapView: failed to initialize MapLibre", err);
      setWebglUnavailable(true);
      onMapUnavailableRef.current?.();
      return;
    }

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
      syncClusterViewport(map);
      scheduleFetch(0);
      const activeUrlViewport = urlViewportRef.current;
      if (!activeUrlViewport || !isSameViewport(getCurrentViewport(map), activeUrlViewport)) {
        scheduleViewportWrite(0);
      }

      // When the user arrived without a search scope or a viewport in the URL,
      // fly to their browser-reported location so the first marker batch
      // matches their area instead of the hardcoded Caribbean default. If the
      // browser blocks or times out, the default viewport stays. "Search
      // scope" covers any active filter/query/tag/location — not just a
      // location filter — because filter-only scopes (e.g. catamarans-for-sale
      // with no location) would otherwise empty the map for users outside a
      // boat region.
      if (
        !activeUrlViewport &&
        !hasSearchScopeRef.current &&
        typeof navigator !== "undefined" &&
        navigator.geolocation
      ) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (!mapRef.current) return;
            beginProgrammaticMove(mapRef.current);
            mapRef.current.once("moveend", () => scheduleFetch(0));
            mapRef.current.easeTo({
              center: [position.coords.longitude, position.coords.latitude],
              zoom: 9,
              duration: 600,
            });
          },
          () => {
            // Silently fall through — user denied or the browser has no GPS.
          },
          { timeout: 5000, maximumAge: 600000 }
        );
      }
    });
    map.on("error", () => {
      if (!map.isStyleLoaded()) {
        setError(t("styleError"));
        setLoading(false);
      }
    });
    map.on("moveend", () => {
      const viewport = getCurrentViewport(map);
      setCurrentViewport(viewport);
      syncClusterViewport(map);
      if (!programmaticMoveRef.current) {
        setHasStaleViewport(hasMapViewportDrifted(lastFetchedViewportRef.current, viewport));
        scheduleViewportWrite();
        // Auto-refresh markers when the user pans or zooms so the visible
        // viewport always reflects the current boat set without requiring a
        // "Search this area" click. scheduleFetch debounces rapid events.
        scheduleFetch();
      }
    });

    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
      if (copyStatusTimeoutRef.current) clearTimeout(copyStatusTimeoutRef.current);
      markersRef.current.forEach((marker) => marker.remove());
      const popup = popupRef.current;
      popupRef.current = null;
      popup?.remove();
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
      setMapReady(false);
    };
    // Intentional: this effect mounts the MapLibre instance exactly once.
    // beginProgrammaticMove and the other callbacks are read fresh via
    // closure each time they fire — adding them to the dep array would
    // tear down and rebuild the map on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.attribution,
    config.enabled,
    config.styleUrl,
    scheduleFetch,
    scheduleViewportWrite,
    syncClusterViewport,
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
    const markerElements = markerElementsRef.current;

    markersRef.current.forEach((marker) => marker.remove());
    markerElements.clear();
    markersRef.current = clusterItems.map((item) => {
      if (item.kind === "cluster") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "oh-map-cluster";
        button.textContent = item.label;
        button.setAttribute("data-testid", "boats-map-cluster");
        button.setAttribute("aria-label", t("clusterLabel", { count: item.count }));
        button.addEventListener("click", () => expandCluster(item));

        return new maplibregl.Marker({ element: button, anchor: "center" })
          .setLngLat([item.lng, item.lat])
          .addTo(map);
      }

      const marker = item.marker;
      const button = document.createElement("button");
      const selected = marker.slug === selectedSlugRef.current;
      button.type = "button";
      button.className = getMarkerClassName(marker, selected);
      button.setAttribute("data-testid", "boats-map-marker");
      button.setAttribute("data-selected", selected ? "true" : "false");
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.setAttribute("aria-label", `${marker.title}, ${marker.locationText || t("unknownLocation")}`);
      let pointerStart: { x: number; y: number } | null = null;
      let pointerHandled = false;
      let keyboardHandled = false;
      const selectFromMarker = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        focusMarker(marker, { recenter: false, scrollListing: true });
      };
      button.addEventListener("pointerdown", (event) => {
        pointerStart = { x: event.clientX, y: event.clientY };
        pointerHandled = false;
      });
      button.addEventListener("pointerup", (event) => {
        if (!pointerStart) return;
        const moved =
          Math.abs(event.clientX - pointerStart.x) > 8 ||
          Math.abs(event.clientY - pointerStart.y) > 8;
        pointerStart = null;
        if (moved) return;

        pointerHandled = true;
        selectFromMarker(event);
        window.setTimeout(() => {
          pointerHandled = false;
        }, 0);
      });
      button.addEventListener("click", (event) => {
        if (pointerHandled || keyboardHandled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        selectFromMarker(event);
      });
      button.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        keyboardHandled = true;
        selectFromMarker(event);
        window.setTimeout(() => {
          keyboardHandled = false;
        }, 250);
      });

      markerElements.set(marker.slug, button);
      const markerInstance = new maplibregl.Marker({ element: button, anchor: "bottom" })
        .setLngLat([marker.lng, marker.lat])
        .addTo(map);

      return markerInstance;
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      markerElements.clear();
    };
  }, [clusterItems, expandCluster, focusMarker, t]);

  if (!config.enabled) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
        {t("disabled")}
      </div>
    );
  }

  if (webglUnavailable) {
    return (
      <div
        data-testid="boats-map-webgl-unavailable"
        className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-secondary"
      >
        <AlertTriangle className="h-5 w-5 text-accent" aria-hidden="true" />
        <p className="font-semibold text-foreground">{t("webglUnavailableTitle")}</p>
        <p className="max-w-md text-xs text-text-tertiary">{t("webglUnavailableBody")}</p>
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
      className="grid min-h-[620px] overflow-hidden rounded-lg border border-border bg-surface lg:h-[calc(100vh-8rem)] lg:max-h-[760px] lg:grid-cols-[minmax(0,1fr)_360px]"
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
            {hasStaleViewport ? (
              <button
                type="button"
                data-testid="boats-map-search-area"
                onClick={handleSearchArea}
                disabled={!mapReady || loading}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary-btn px-2.5 py-1.5 font-semibold text-white transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                {t("searchArea")}
              </button>
            ) : null}
          </div>
          <div role="status" aria-live="polite" aria-atomic="true">
            {copyStatus !== "idle" ? (
              <div className="pointer-events-auto inline-flex w-fit rounded-lg border border-border bg-background/90 px-3 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur">
                {copyStatus === "copied" ? t("copySuccess") : t("copyFailed")}
              </div>
            ) : null}
          </div>
          {(loading || error || notice || hasStaleViewport) && (
            <div className="pointer-events-auto inline-flex w-fit max-w-full items-center gap-2 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs text-text-secondary shadow-lg backdrop-blur">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
              {error ? <AlertTriangle className="h-4 w-4 text-accent" /> : null}
              <span>{loading ? t("loading") : error || notice || t("staleArea")}</span>
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

        <div
          ref={sidebarScrollRef}
          data-testid="boats-map-list-scroll"
          className="flex-1 overflow-y-auto p-3"
        >
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
                const displayedPrice = getMapMarkerPrice(marker, displayCurrency);
                const loa = formatLoa(marker.loa);
                return (
                  <div
                    key={marker.slug}
                    ref={(node) => {
                      if (node) {
                        listingRefs.current.set(marker.slug, node);
                      } else {
                        listingRefs.current.delete(marker.slug);
                      }
                    }}
                    data-testid="boats-map-listing"
                    data-selected={selected ? "true" : "false"}
                    className={`rounded-lg border p-3 transition-colors ${
                      selected
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-surface hover:border-primary/35"
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => focusMarker(marker)}
                      className="grid w-full grid-cols-[92px_minmax(0,1fr)] gap-3 text-left"
                    >
                      <div className="relative h-[70px] overflow-hidden rounded-md bg-muted">
                        {marker.heroUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- map thumbnails use sanitized, arbitrary broker/CDN URLs.
                          <img
                            src={marker.heroUrl}
                            alt={[marker.title, marker.locationText || null]
                              .filter(Boolean)
                              .join(" in ")}
                            loading="lazy"
                            decoding="async"
                            data-testid="boats-map-listing-image"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            data-testid="boats-map-listing-image-fallback"
                            className="flex h-full w-full items-center justify-center bg-surface-elevated text-text-tertiary"
                          >
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p
                          data-testid="boats-map-listing-price"
                          className="text-sm font-bold text-foreground"
                        >
                          {displayedPrice?.primary || t("priceUnavailable")}
                        </p>
                        {displayedPrice?.secondary ? (
                          <p className="truncate text-[11px] text-text-tertiary">
                            {displayedPrice.secondary}
                          </p>
                        ) : null}
                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
                          {marker.title}
                        </p>
                        {marker.locationText && (
                          <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                            {marker.locationText}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase text-text-tertiary">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {getPrecisionLabel()}
                            {marker.approximate ? ` ${t("approximate")}` : ""}
                          </span>
                          {loa ? (
                            <span className="inline-flex items-center gap-1">
                              <Ruler className="h-3.5 w-3.5 text-primary" />
                              {loa}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                    <Link
                      href={getMarkerHref(marker.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
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
