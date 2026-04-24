"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { localizedHref } from "@/i18n/href";
import Image from "next/image";
import Link from "@/components/LocaleLink";
import BoatCard from "@/components/BoatCard";
import CurrencySelector from "@/components/CurrencySelector";
import { useCompareBoats } from "@/hooks/useCompareBoats";
import SeoHubLinks from "@/components/seo/SeoHubLinks";
import { buildBoatBrowseSummary } from "@/lib/browse-summary";
import { buildBoatSearchParams } from "@/lib/search/boat-search";
import { getPublicMapClientConfig } from "@/lib/config/public-map";
import { MAP_MARKER_DEFAULT_LIMIT } from "@/lib/locations/map-bounds";
import {
  parseMapViewportFromParams,
  setMapUrlParams,
  stripMapUrlParams,
  wantsMapView,
  MAP_CENTER_PARAM,
  MAP_ZOOM_PARAM,
  MAP_VIEW_PARAM,
  MAP_VIEW_VALUE,
} from "@/lib/locations/map-url-state";
import { getInitialMapViewport, type MapInitialViewport } from "@/lib/locations/map-viewports";
import {
  canonicalizeLocationParam,
  getFeaturedLocationMarkets,
  getLocationDisplayName,
  TOP_LOCATION_MARKETS,
} from "@/lib/locations/top-markets";
import {
  getDisplayedPrice,
  normalizeSupportedCurrency,
  readPreferredCurrencyFromBrowser,
  type SupportedCurrency,
} from "@/lib/currency";
import { isLocalMediaUrl } from "@/lib/media";
import { getSafeExternalUrl } from "@/lib/url-safety";
import {
  Search,
  SlidersHorizontal,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Bell,
  BookmarkPlus,
  ExternalLink,
  GitCompareArrows,
  Grid2X2,
  List,
  Map,
  MapPin,
  Ruler,
  Sailboat,
} from "lucide-react";

type SortField = "price" | "size" | "year" | "newest";
type SortDir = "asc" | "desc";
type ViewMode = "grid" | "rows" | "map";
type SearchParamReader = { get: (key: string) => string | null };

const BoatsMapView = dynamic(() => import("@/components/BoatsMapView"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[620px] items-center justify-center rounded-lg border border-border bg-surface text-sm text-text-secondary">
      Loading map...
    </div>
  ),
});

export interface Boat {
  id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  asking_price_usd: number | null;
  location_text: string | null;
  location_country?: string | null;
  location_region?: string | null;
  location_market_slugs?: string[];
  location_confidence?: string | null;
  location_approximate?: boolean | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_geocode_precision?: string | null;
  slug: string | null;
  is_sample: boolean;
  hero_url: string | null;
  specs: { loa?: number; rig_type?: string; vessel_type?: string };
  character_tags: string[];
  source_site?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  ai_summary?: string | null;
}

interface FilterState {
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  minLoa: string;
  maxLoa: string;
  rigType: string;
  hullType: string;
}

const EMPTY_FILTERS: FilterState = {
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  minLoa: "",
  maxLoa: "",
  rigType: "",
  hullType: "",
};
const FEATURED_LOCATION_MARKETS = getFeaturedLocationMarkets();
const PUBLIC_MAP_CLIENT_CONFIG = getPublicMapClientConfig();

function normalizeSortField(value: string | null): SortField {
  return value === "price" || value === "size" || value === "year" || value === "newest"
    ? value
    : "newest";
}

function normalizeSortDir(value: string | null, field: SortField): SortDir {
  if (value === "asc" || value === "desc") return value;
  return field === "newest" ? "desc" : "asc";
}

function filtersFromParams(
  searchParams: SearchParamReader,
  seed?: Partial<FilterState>
): FilterState {
  return {
    minPrice: searchParams.get("minPrice") || seed?.minPrice || "",
    maxPrice: searchParams.get("maxPrice") || seed?.maxPrice || "",
    minYear: searchParams.get("minYear") || seed?.minYear || "",
    maxYear: searchParams.get("maxYear") || seed?.maxYear || "",
    minLoa: searchParams.get("minLoa") || seed?.minLoa || "",
    maxLoa: searchParams.get("maxLoa") || seed?.maxLoa || "",
    rigType: searchParams.get("rigType") || seed?.rigType || "",
    hullType: searchParams.get("hullType") || seed?.hullType || "",
  };
}

export interface BoatBrowseProps {
  // URL params take precedence; these fill in when a param is absent, letting
  // hub pages (catamarans-for-sale, make/location pages) pre-scope the browse.
  initialFilters?: Partial<FilterState>;
  initialLocation?: string;
  initialSearch?: string;
  // Optional hub context: the hub page folds its heading + intro into the
  // browse header instead of stacking a separate hero band above.
  heading?: string;
  description?: string;
  eyebrow?: string;
  // Server-rendered inventory for the first paint. SEO hubs pass this so the
  // initial HTML contains real boat cards (not an empty shimmer) for
  // crawlers. Client-side fetches can still override as the user filters.
  initialBoats?: Boat[];
  initialTotal?: number;
  // Optional: server-computed viewport that frames the hub's filtered boats.
  // Used when the hub has no location scope (e.g. /catamarans-for-sale) —
  // otherwise the map would keep the Caribbean default while the actual
  // catamarans span Florida / Med / SE Asia.
  seedMapViewport?: { latitude: number; longitude: number; zoom: number };
}

function formatBoatType(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildSearchFocusLabel(input: {
  search: string;
  location: string;
  tag: string;
  filters: FilterState;
}) {
  if (input.location.trim()) {
    return getLocationDisplayName(input.location);
  }
  if (input.search.trim()) {
    return input.search.trim();
  }
  if (input.tag.trim()) {
    return input.tag.replace(/[-_]+/g, " ");
  }
  if (input.filters.hullType) {
    return input.filters.hullType.replace(/[-_]+/g, " ");
  }
  if (input.filters.rigType) {
    return input.filters.rigType.replace(/[-_]+/g, " ");
  }
  return "this market";
}

export default function BoatBrowse(props: BoatBrowseProps = {}) {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-text-secondary">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shimmer aspect-[4/3] rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <BoatBrowseInner {...props} />
    </Suspense>
  );
}

function BoatBrowseInner({
  initialFilters: seedFilters,
  initialLocation: seedLocation,
  initialSearch: seedSearch,
  heading: headingOverride,
  description,
  eyebrow,
  initialBoats: seedBoats,
  initialTotal: seedTotal,
  seedMapViewport,
}: BoatBrowseProps) {
  const t = useTranslations("boatsPage");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const initialQ = searchParams.get("q") || seedSearch || "";
  const initialLocation =
    canonicalizeLocationParam(searchParams.get("location")) ||
    canonicalizeLocationParam(seedLocation) ||
    "";
  const initialTag = searchParams.get("tag") || "";
  const requestedCurrency = searchParams.get("currency");
  const initialCurrency = requestedCurrency
    ? normalizeSupportedCurrency(requestedCurrency)
    : null;
  const initialSortField = normalizeSortField(searchParams.get("sort"));
  const initialSortDir = normalizeSortDir(searchParams.get("dir"), initialSortField);
  const initialFilters = filtersFromParams(searchParams, seedFilters);
  const rawSearchParamString = searchParams.toString();
  const initialViewMode =
    PUBLIC_MAP_CLIENT_CONFIG.enabled && wantsMapView(searchParams) ? "map" : "grid";

  // Seed from server when the hub page pre-fetches — lets crawlers (and the
  // first client paint) see real boat cards instead of a shimmer.
  const hasSeedInventory = Array.isArray(seedBoats) && seedBoats.length > 0;
  const [boats, setBoats] = useState<Boat[]>(seedBoats ?? []);
  const [loading, setLoading] = useState(!hasSeedInventory);
  // BoatBrowse has two mount-time refetch effects — one on sort/currency, one
  // on search-param changes. Both would otherwise clobber the seeded inventory
  // on first paint (flicker), and the server-side hub SQL (character_tags OR
  // make) returns a different set than /api/boats?hullType= (vessel_type), so
  // the flicker is not just cosmetic. Each effect gets its own skip flag and
  // flips it off after the mount run, so subsequent URL/sort changes fetch.
  const skipInitialSortFetchRef = useRef(hasSeedInventory);
  const skipInitialParamsFetchRef = useRef(hasSeedInventory);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(initialQ);
  const [locationInput, setLocationInput] = useState(getLocationDisplayName(initialLocation));
  const [search, setSearch] = useState(initialQ);
  const [locationFilter, setLocationFilter] = useState(initialLocation);
  const [activeTag, setActiveTag] = useState(initialTag);
  const [total, setTotal] = useState(seedTotal ?? 0);
  const [page, setPage] = useState(1);
  // Map users expect filters to be visible next to the inventory, so the panel
  // opens by default when the map view is active. In grid/rows the panel stays
  // collapsed until the user asks for it.
  const [showFilters, setShowFilters] = useState(() =>
    PUBLIC_MAP_CLIENT_CONFIG.enabled && wantsMapView(searchParams)
  );
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>(() =>
    initialCurrency || readPreferredCurrencyFromBrowser()
  );
  const [locationMarketCounts, setLocationMarketCounts] = useState<Record<string, number>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSearchFormReady, setIsSearchFormReady] = useState(false);
  const { compareCount, isCompared, toggleBoat, maxCompareBoats } = useCompareBoats();
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(initialFilters);

  const BATCH_SIZE = 30;
  const isLoggedIn = status === "authenticated";
  const compareReady = compareCount > 0;
  const compareCountLabel = t("compareFilled", { count: compareCount });

  const boatSearchParamString = useMemo(() => {
    const params = new URLSearchParams(rawSearchParamString);
    stripMapUrlParams(params);
    return params.toString();
  }, [rawSearchParamString]);
  const urlMapViewport = useMemo(
    () => parseMapViewportFromParams(searchParams),
    [searchParams]
  );
  const homeMapViewport = useMemo(
    () => {
      // Server-computed viewport wins when the hub has no location scope but
      // does have a real filter-matched bbox (e.g. catamarans spread across
      // Florida / Med / SE Asia). Location-scoped hubs keep the per-location
      // preset.
      if (!locationFilter && seedMapViewport) return seedMapViewport;
      return getInitialMapViewport(locationFilter);
    },
    [locationFilter, seedMapViewport]
  );
  const initialMapViewport = useMemo(
    () => urlMapViewport || homeMapViewport,
    [homeMapViewport, urlMapViewport]
  );

  useEffect(() => {
    setIsSearchFormReady(true);
  }, []);

  // Keep filters expanded whenever the user is on the map view — they were
  // told "Browse Boats" has filters, but on the map the sidebar is the only
  // affordance that hints at them, so hiding the panel feels like they went
  // missing.
  useEffect(() => {
    if (viewMode === "map") setShowFilters(true);
  }, [viewMode]);

  useEffect(() => {
    if (PUBLIC_MAP_CLIENT_CONFIG.enabled && wantsMapView(searchParams)) {
      setViewMode("map");
      return;
    }

    const savedView = window.localStorage.getItem("boats_view_mode");
    if (savedView === "grid" || savedView === "rows") {
      setViewMode(savedView);
    } else if (savedView === "map" && PUBLIC_MAP_CLIENT_CONFIG.enabled) {
      setViewMode(savedView);
      const params = new URLSearchParams(rawSearchParamString);
      params.set(MAP_VIEW_PARAM, MAP_VIEW_VALUE);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [pathname, rawSearchParamString, router, searchParams]);

  useEffect(() => {
    if (PUBLIC_MAP_CLIENT_CONFIG.enabled || !wantsMapView(searchParams)) return;
    const params = new URLSearchParams(rawSearchParamString);
    stripMapUrlParams(params);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, rawSearchParamString, router, searchParams]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/boats/location-markets")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.counts && typeof data.counts === "object") {
          setLocationMarketCounts(data.counts);
        }
      })
      .catch(() => {
        if (!cancelled) setLocationMarketCounts({});
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialCurrency) {
      setDisplayCurrency(initialCurrency);
      return;
    }

    const browserCurrency = readPreferredCurrencyFromBrowser();
    setDisplayCurrency((currentCurrency) =>
      currentCurrency === browserCurrency ? currentCurrency : browserCurrency
    );
  }, [initialCurrency]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      // Same field — reverse direction
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      // New field — set smart defaults
      setSortField(field);
      setSortDir(field === "newest" ? "desc" : "asc");
    }
  }

  function handleViewMode(nextView: ViewMode) {
    if (nextView === "map" && !PUBLIC_MAP_CLIENT_CONFIG.enabled) return;
    setViewMode(nextView);
    window.localStorage.setItem("boats_view_mode", nextView);

    const params = new URLSearchParams(window.location.search);
    if (nextView === "map") {
      params.set(MAP_VIEW_PARAM, MAP_VIEW_VALUE);
    } else {
      stripMapUrlParams(params);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function clearSearchCriteria() {
    setSearchInput("");
    setLocationInput("");
    setSearch("");
    setLocationFilter("");
    setActiveTag("");
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSaveMessage(null);
    router.push(localizedHref("/boats", locale));
  }

  // Refetch when sort changes. On SSR hubs we seeded `boats` with the
  // server inventory that already matches the initial filters, so the first
  // mount should not re-fetch (avoid a shimmer blink) — let subsequent
  // changes flow through normally.
  useEffect(() => {
    if (skipInitialSortFetchRef.current) {
      skipInitialSortFetchRef.current = false;
      return;
    }
    fetchBoats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDir, displayCurrency]);

  const buildParams = useCallback((
    q?: string,
    tag?: string,
    pageNum?: number,
    filterState?: FilterState,
    nextLocation?: string
  ) => {
    const params = new URLSearchParams();
    const searchQ = q !== undefined ? q : search;
    const searchTag = tag !== undefined ? tag : activeTag;
    const currentLocation = (nextLocation !== undefined ? nextLocation : locationFilter).trim();
    const currentFilters = filterState ?? appliedFilters;
    if (searchQ) params.set("q", searchQ);
    if (currentLocation) {
      params.set("location", canonicalizeLocationParam(currentLocation) || currentLocation);
    }
    if (searchTag) params.set("tag", searchTag);
    params.set("page", String(pageNum || page));
    params.set("limit", String(BATCH_SIZE));
      if (currentFilters.minPrice) params.set("minPrice", currentFilters.minPrice);
      if (currentFilters.maxPrice) params.set("maxPrice", currentFilters.maxPrice);
      if (currentFilters.minYear) params.set("minYear", currentFilters.minYear);
      if (currentFilters.maxYear) params.set("maxYear", currentFilters.maxYear);
      if (currentFilters.rigType) params.set("rigType", currentFilters.rigType);
      if (currentFilters.hullType) params.set("hullType", currentFilters.hullType);
      if (displayCurrency !== "USD") params.set("currency", displayCurrency);
    params.set("sort", sortField);
    params.set("dir", sortDir);
    return params;
  }, [search, activeTag, locationFilter, page, appliedFilters, displayCurrency, sortField, sortDir]);

  const navigateToBrowse = useCallback((
    q?: string,
    tag?: string,
    filterState?: FilterState,
    nextLocation?: string
  ) => {
    const params = buildParams(q, tag, 1, filterState, nextLocation);
    if (viewMode === "map" && PUBLIC_MAP_CLIENT_CONFIG.enabled) {
      const currentParams = new URLSearchParams(window.location.search);
      params.set(MAP_VIEW_PARAM, MAP_VIEW_VALUE);
      const center = currentParams.get(MAP_CENTER_PARAM);
      const zoom = currentParams.get(MAP_ZOOM_PARAM);
      if (center) params.set(MAP_CENTER_PARAM, center);
      if (zoom) params.set(MAP_ZOOM_PARAM, zoom);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [buildParams, pathname, router, viewMode]);

  async function fetchBoats(
    q?: string,
    tag?: string,
    filterState?: FilterState,
    nextLocation?: string
  ) {
    setLoading(true);
    setError(null);
    setPage(1);
    const nextSearch = q !== undefined ? q : search;
    const nextTag = tag !== undefined ? tag : activeTag;
    const resolvedLocation = (nextLocation !== undefined ? nextLocation : locationFilter).trim();
    const nextFilters = filterState ?? appliedFilters;
    try {
      const params = buildParams(nextSearch, nextTag, 1, nextFilters, resolvedLocation);
      const res = await fetch(`/api/boats?${params}`);
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setBoats(data.boats || []);
      setTotal(data.total || 0);
      setSearch(nextSearch);
      setLocationFilter(resolvedLocation);
      setActiveTag(nextTag);
      setAppliedFilters(nextFilters);
    } catch {
      setError(t("loadError"));
      setBoats([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const params = buildParams(undefined, undefined, nextPage);
      const res = await fetch(`/api/boats?${params}`);
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setBoats((prev) => [...prev, ...(data.boats || [])]);
      setPage(nextPage);
    } catch {
      // Keep existing boats on load-more failure — only show a subtle indicator
      setError(t("loadMoreError"));
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const filteredSearchParams = new URLSearchParams(boatSearchParamString);
    const q = filteredSearchParams.get("q") || seedSearch || "";
    const rawLocation = filteredSearchParams.get("location") || "";
    const location =
      canonicalizeLocationParam(rawLocation) ||
      canonicalizeLocationParam(seedLocation) ||
      "";
    const tag = filteredSearchParams.get("tag") || "";
    const nextFilters = filtersFromParams(filteredSearchParams, seedFilters);
    if (rawLocation && location && rawLocation !== location) {
      const params = buildParams(q, tag, 1, nextFilters, location);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      // The replace re-fires this effect with the canonical URL. Clear the
      // skip ref so that second pass is allowed to fetch — otherwise `total`
      // / `hasMore` would stay at seed values until the user interacts.
      skipInitialParamsFetchRef.current = false;
      return;
    }
    setSearchInput(q);
    setLocationInput(getLocationDisplayName(location));
    setSearch(q);
    setLocationFilter(location);
    setActiveTag(tag);
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    // Preserve the SSR seed on first mount — the hub server SQL and
    // /api/boats filter semantics don't always agree (character_tags vs
    // vessel_type), and refetching here would flicker half the cards out.
    // Once the user changes the URL (filter, sort, location) the effect
    // fires normally and the client takes over.
    if (skipInitialParamsFetchRef.current) {
      skipInitialParamsFetchRef.current = false;
      return;
    }
    fetchBoats(q, tag, nextFilters, location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boatSearchParamString]);

  const handleMapViewportChange = useCallback((viewport: MapInitialViewport) => {
    const params = new URLSearchParams(window.location.search);
    setMapUrlParams(params, viewport);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }, [pathname]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const nextSearch = String(formData.get("q") || "");
    const nextLocation = String(formData.get("location") || "");

    setSearchInput(nextSearch);
    setLocationInput(nextLocation);
    navigateToBrowse(nextSearch, "", filters, nextLocation);
  }

  function clearTag() {
    navigateToBrowse(search, "", appliedFilters, locationFilter);
  }

  function clearLocation() {
    setLocationInput("");
    navigateToBrowse(search, activeTag, appliedFilters, "");
  }

  const hasMore = boats.length < total;
  const currentSearchFilters = useMemo(() => ({
    search,
    location: locationFilter || null,
    tag: activeTag,
    minPrice: appliedFilters.minPrice || null,
    maxPrice: appliedFilters.maxPrice || null,
    minYear: appliedFilters.minYear || null,
    maxYear: appliedFilters.maxYear || null,
    minLoa: appliedFilters.minLoa || null,
    maxLoa: appliedFilters.maxLoa || null,
    rigType: appliedFilters.rigType || null,
    hullType: appliedFilters.hullType || null,
    currency: displayCurrency,
    sort: sortField,
    dir: sortDir,
  }), [
    activeTag,
    appliedFilters.hullType,
    appliedFilters.maxPrice,
    appliedFilters.maxYear,
    appliedFilters.maxLoa,
    appliedFilters.minPrice,
    appliedFilters.minYear,
    appliedFilters.minLoa,
    appliedFilters.rigType,
    displayCurrency,
    locationFilter,
    search,
    sortDir,
    sortField,
  ]);
  const currentSearchParams = buildBoatSearchParams(currentSearchFilters);
  const mapSearchParamString = useMemo(() => {
    const params = buildBoatSearchParams(currentSearchFilters);
    params.set("limit", String(MAP_MARKER_DEFAULT_LIMIT));
    return params.toString();
  }, [currentSearchFilters]);
  const currentBrowseUrl = `${pathname}${currentSearchParams.toString() ? `?${currentSearchParams}` : ""}`;
  const profileCallbackUrl = `/onboarding/profile?callbackUrl=${encodeURIComponent(currentBrowseUrl)}`;
  const matchedCtaHref = isLoggedIn
    ? profileCallbackUrl
    : `/sign-in?callbackUrl=${encodeURIComponent(profileCallbackUrl)}`;
  const hasActiveSearchCriteria =
    search.trim().length > 0 ||
    locationFilter.trim().length > 0 ||
    activeTag.trim().length > 0 ||
    Boolean(
        appliedFilters.minPrice ||
        appliedFilters.maxPrice ||
        appliedFilters.minYear ||
        appliedFilters.maxYear ||
        appliedFilters.rigType ||
        appliedFilters.hullType
      );
  const searchFocusLabel = buildSearchFocusLabel({
    search,
    location: locationFilter,
    tag: activeTag,
    filters: appliedFilters,
  });
  const locationFilterLabel = getLocationDisplayName(locationFilter);

  const inputClass =
    "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

  async function saveSearch() {
    setSaveMessage(null);

    if (!isLoggedIn) {
      const callbackParams = buildBoatSearchParams(currentSearchFilters);
      const callbackUrl = `${pathname}${callbackParams.toString() ? `?${callbackParams}` : ""}`;
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    setSaveLoading(true);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentSearchFilters),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t("saveSearchError"));
      }

      window.dispatchEvent(new CustomEvent("saved-searches:updated"));
      setSaveMessage(
        data.duplicate
          ? t("saveSearchDuplicate")
          : t("saveSearchSuccess")
      );
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : t("saveSearchError"));
    } finally {
      setSaveLoading(false);
    }
  }

  const sortLabels: Record<SortField, string> = {
    price: t("sort.price"),
    size: t("sort.size"),
    year: t("sort.year"),
    newest: t("sort.newest"),
  };
  const hullTypeOptions = [
    ["catamaran", t("boatTypes.catamaran")],
    ["trimaran", t("boatTypes.trimaran")],
    ["monohull", t("boatTypes.monohull")],
    ["powerboat", t("boatTypes.powerboat")],
  ] as const;
  const rigTypeOptions = [
    ["sloop", t("rigTypes.sloop")],
    ["cutter", t("rigTypes.cutter")],
    ["ketch", t("rigTypes.ketch")],
    ["yawl", t("rigTypes.yawl")],
    ["schooner", t("rigTypes.schooner")],
  ] as const;

  return (
    <div className="pb-16">
      {/* Page Header + Search */}
      <div className="border-b border-border bg-surface/50">
        <div className="mx-auto max-w-7xl px-5 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {eyebrow && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {eyebrow}
                </p>
              )}
              <h1 className={headingOverride ? "text-3xl font-bold tracking-tight sm:text-4xl" : "text-2xl font-bold"}>
                {headingOverride || t("heading")}
              </h1>
              {description && (
                <p className="mt-3 max-w-3xl text-sm text-text-secondary sm:text-base">
                  {description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {!loading && (
                  <p className="text-sm text-text-secondary">
                    {t("boatCount", { count: total })}
                  </p>
                )}
                <CurrencySelector
                  id="boats-currency"
                  value={displayCurrency}
                  onChange={setDisplayCurrency}
                />
                <button
                  type="button"
                  onClick={saveSearch}
                  disabled={saveLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {isLoggedIn ? <BookmarkPlus className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  {saveLoading
                    ? t("saving")
                    : isLoggedIn
                      ? t("saveSearch")
                      : t("signInToSave")}
                </button>
              </div>
              {saveMessage && (
                <p className="mt-2 text-sm text-primary">
                  {saveMessage}
                </p>
              )}
              {hasActiveSearchCriteria && !loading && (
                <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">
                    {t("saveSearchLeadTitle", { label: searchFocusLabel })}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {t("saveSearchLeadBody", { label: searchFocusLabel })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={saveSearch}
                      disabled={saveLoading}
                      className="rounded-full bg-primary-btn px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
                    >
                      {saveLoading ? t("saving") : t("saveThisSearch")}
                    </button>
                    <Link
                      href={matchedCtaHref}
                      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
                    >
                      {t("getMatchedForSearch")}
                    </Link>
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-xs text-text-secondary">
                  {t("compareShortlist", { count: compareCount, max: maxCompareBoats })}
                </p>
                <Link
                  href="/compare"
                  data-testid="compare-open-link"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    compareReady
                      ? "border-amber-400/60 bg-amber-300/10 text-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.18)] hover:border-amber-300 hover:text-amber-100"
                      : "border-border text-text-secondary hover:border-primary/40 hover:text-primary"
                  }`}
                  aria-label={
                    compareReady
                      ? t("compareOpenAriaSelected", { count: compareCount })
                      : t("compareOpenAria")
                  }
                >
                  <GitCompareArrows className="h-3.5 w-3.5" />
                  {compareReady ? t("openCompare") : t("comparePage")}
                  {compareReady && (
                    <>
                      <span className="inline-flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full border-2 border-amber-300 bg-amber-300/15 px-1.5 text-[10px] font-bold text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.25)]">
                        {compareCount}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/85">
                        {compareCountLabel}
                      </span>
                    </>
                  )}
                </Link>
              </div>
            </div>

            <form
              onSubmit={handleSearch}
              data-testid="boats-search-form"
              data-ready={isSearchFormReady ? "true" : "false"}
              className="grid w-full max-w-2xl flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_auto_auto] sm:justify-end"
            >
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  name="q"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className={`${inputClass} w-full pl-9`}
                />
              </div>
              <div className="relative min-w-0">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  name="location"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  list="boats-location-markets"
                  placeholder={t("locationPlaceholder")}
                  data-testid="boats-location-input"
                  className={`${inputClass} w-full pl-9`}
                />
                <datalist id="boats-location-markets">
                  {TOP_LOCATION_MARKETS.map((market) => (
                    <option key={market.slug} value={market.label} />
                  ))}
                </datalist>
              </div>
              <button
                type="submit"
                className="rounded-lg bg-primary-btn px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light"
              >
                {t("searchButton")}
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="boats-filter-toggle"
                className={`rounded-lg border px-3 py-2 transition-colors ${
                  showFilters
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-secondary hover:text-foreground"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </form>
          </div>

          {(activeTag || locationFilter) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {locationFilter && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  <MapPin className="h-3.5 w-3.5" />
                  {t("locationChip", { location: locationFilterLabel })}
                  <button onClick={clearLocation} className="text-primary/60 hover:text-primary" aria-label={t("clearLocation")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              {activeTag && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {activeTag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  <button onClick={clearTag} className="text-primary/60 hover:text-primary" aria-label={t("clearFilter")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>
          )}

          {!locationFilter && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-text-tertiary">
                {t("popularMarkets")}
              </span>
              {FEATURED_LOCATION_MARKETS.map((market) => (
                <button
                  key={market.slug}
                  type="button"
                  onClick={() => navigateToBrowse(searchInput, activeTag, filters, market.slug)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-primary/40 hover:text-primary"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {market.label}
                  {locationMarketCounts[market.slug] ? (
                    <span className="text-text-tertiary">
                      {t("marketCount", { count: locationMarketCounts[market.slug] })}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-border bg-surface p-4">
              <input
                type="number"
                placeholder={t("minPrice")}
                value={filters.minPrice}
                onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
                className={`${inputClass} w-28`}
              />
              <input
                type="number"
                placeholder={t("maxPrice")}
                value={filters.maxPrice}
                onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
                className={`${inputClass} w-28`}
              />
              <input
                type="number"
                placeholder={t("minYear")}
                value={filters.minYear}
                onChange={(e) => setFilters((f) => ({ ...f, minYear: e.target.value }))}
                className={`${inputClass} w-28 min-w-[7rem]`}
              />
              <input
                type="number"
                placeholder={t("maxYear")}
                value={filters.maxYear}
                onChange={(e) => setFilters((f) => ({ ...f, maxYear: e.target.value }))}
                className={`${inputClass} w-28 min-w-[7rem]`}
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder={t("minLoa")}
                value={filters.minLoa}
                onChange={(e) => setFilters((f) => ({ ...f, minLoa: e.target.value }))}
                data-testid="boats-filter-min-loa"
                className={`${inputClass} w-28 min-w-[7rem]`}
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder={t("maxLoa")}
                value={filters.maxLoa}
                onChange={(e) => setFilters((f) => ({ ...f, maxLoa: e.target.value }))}
                data-testid="boats-filter-max-loa"
                className={`${inputClass} w-28 min-w-[7rem]`}
              />
              <select
                value={filters.hullType}
                onChange={(e) => setFilters((f) => ({ ...f, hullType: e.target.value }))}
                data-testid="boats-filter-boat-type"
                className={inputClass}
              >
                <option value="">{t("allBoatTypes")}</option>
                {hullTypeOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                value={filters.rigType}
                onChange={(e) => setFilters((f) => ({ ...f, rigType: e.target.value }))}
                className={inputClass}
              >
                <option value="">{t("allRigs")}</option>
                {rigTypeOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                onClick={() => navigateToBrowse(searchInput, activeTag, filters, locationInput)}
                className="rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white hover:bg-primary-light"
              >
                {t("applyFilters")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sort Bar */}
      <div className="border-b border-border bg-surface/30">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 overflow-x-auto">
            <span className="mr-1 text-xs text-text-tertiary whitespace-nowrap">{t("sortBy")}</span>
            {(["price", "size", "year", "newest"] as SortField[]).map((field) => {
              const active = sortField === field;
              return (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                    active
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "text-text-secondary hover:text-foreground hover:bg-surface-elevated border border-transparent"
                  }`}
                >
                  {sortLabels[field]}
                  {active ? (
                    sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="inline-flex self-start rounded-full border border-border bg-surface p-1">
            <button
              type="button"
              onClick={() => handleViewMode("grid")}
              data-testid="boats-view-toggle-grid"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                viewMode === "grid"
                  ? "bg-primary-btn text-white"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              <Grid2X2 className="h-4 w-4" />
              {t("view.grid")}
            </button>
            <button
              type="button"
              onClick={() => handleViewMode("rows")}
              data-testid="boats-view-toggle-rows"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                viewMode === "rows"
                  ? "bg-primary-btn text-white"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
              {t("view.rows")}
            </button>
            {PUBLIC_MAP_CLIENT_CONFIG.enabled && (
              <button
                type="button"
                onClick={() => handleViewMode("map")}
                data-testid="boats-view-toggle-map"
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  viewMode === "map"
                    ? "bg-primary-btn text-white"
                    : "text-text-secondary hover:text-foreground"
                }`}
              >
                <Map className="h-4 w-4" />
                {t("view.map")}
              </button>
            )}
          </div>
        </div>
      </div>

      {!hasActiveSearchCriteria && viewMode !== "map" && (
        <div className="pt-6">
          <SeoHubLinks
            compact
            title={t("searchHubsTitle")}
            subtitle={t("searchHubsSubtitle")}
          />
        </div>
      )}

      {/* Results */}
      <div className="mx-auto max-w-7xl px-5 pt-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
            <button
              onClick={() => { setError(null); fetchBoats(); }}
              className="ml-3 font-medium text-red-300 underline hover:text-red-200"
            >
              {t("retry")}
            </button>
          </div>
        )}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="shimmer aspect-[4/3]" />
                <div className="space-y-3 p-4">
                  <div className="shimmer h-5 w-3/4 rounded" />
                  <div className="shimmer h-4 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : boats.length === 0 ? (
          <div className="space-y-8 py-16">
            <div className="flex justify-center text-primary">
              <Sailboat className="h-10 w-10" aria-hidden="true" />
            </div>
            <p className="mt-4 text-lg font-medium text-foreground">{t("noResultsTitle")}</p>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-text-secondary">
              {t("noResultsSubtitle")}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={clearSearchCriteria}
                className="rounded-full bg-primary-btn px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
              >
                {t("clearFilters")}
              </button>
              <Link
                href="/catamarans-for-sale"
                className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
              >
                {t("browseCatamarans")}
              </Link>
              <Link
                href="/boats/location/puerto-rico"
                className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
              >
                {t("puertoRicoBoats")}
              </Link>
            </div>
            <SeoHubLinks
              compact
              title={t("liveMarketsTitle")}
              subtitle={t("liveMarketsSubtitle")}
            />
          </div>
        ) : (
          <>
            {viewMode === "map" && PUBLIC_MAP_CLIENT_CONFIG.enabled ? (
              <BoatsMapView
                searchParams={mapSearchParamString}
                locationFilter={locationFilter}
                locationLabel={locationFilterLabel}
                initialViewport={initialMapViewport}
                homeViewport={homeMapViewport}
                urlViewport={urlMapViewport}
                displayCurrency={displayCurrency}
                onViewportChange={handleMapViewportChange}
                hasSearchScope={hasActiveSearchCriteria}
                onMapUnavailable={() => setViewMode("grid")}
              />
            ) : viewMode === "grid" ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {boats.map((boat) => (
                  <BoatCard
                    key={boat.id}
                    boat={boat}
                    displayCurrency={displayCurrency}
                    onCompareToggle={() => toggleBoat(boat.id)}
                    compareSelected={isCompared(boat.id)}
                    compareDisabled={!isCompared(boat.id) && compareCount >= maxCompareBoats}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {boats.map((boat) => (
                  <BoatBrowseRow
                    key={boat.id}
                    boat={boat}
                    displayCurrency={displayCurrency}
                    onCompareToggle={() => toggleBoat(boat.id)}
                    compareSelected={isCompared(boat.id)}
                    compareDisabled={!isCompared(boat.id) && compareCount >= maxCompareBoats}
                  />
                ))}
              </div>
            )}

            {hasMore && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-full border border-border px-8 py-3 text-sm font-medium text-text-secondary transition-all hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      {t("loadingMore")}
                    </span>
                  ) : (
                    t("showMore", { count: total - boats.length })
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BoatBrowseRow({
  boat,
  displayCurrency,
  onCompareToggle,
  compareSelected,
  compareDisabled,
}: {
  boat: Boat;
  displayCurrency: SupportedCurrency;
  onCompareToggle: () => void;
  compareSelected: boolean;
  compareDisabled: boolean;
}) {
  const t = useTranslations("boatsPage");
  const href = `/boats/${boat.slug || boat.id}`;
  const safeSourceUrl = getSafeExternalUrl(boat.source_url);
  const displayedPrice = getDisplayedPrice({
    amount: boat.asking_price,
    nativeCurrency: boat.currency,
    amountUsd: boat.asking_price_usd,
    preferredCurrency: displayCurrency,
  });
  const vesselType = formatBoatType(boat.specs.vessel_type);
  const summary = buildBoatBrowseSummary({
    summary: boat.ai_summary,
    title: `${boat.year} ${boat.make} ${boat.model}`,
    locationText: boat.location_text,
    sourceSite: boat.source_site,
  });
  const hasSummary = summary.length > 0;

  return (
    <div
      data-testid="boat-row-card"
      className="overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div className="grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
        <Link href={href} className="relative block min-h-[220px] bg-muted">
          {boat.hero_url ? (
            <Image
              src={boat.hero_url}
              alt={`${boat.year} ${boat.make} ${boat.model}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 280px"
              unoptimized={!isLocalMediaUrl(boat.hero_url)}
              quality={isLocalMediaUrl(boat.hero_url) ? 84 : undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-elevated text-5xl opacity-20">
              {t("boatFallback")}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-4 left-4">
            <p className="text-2xl font-bold text-white">{displayedPrice.primary}</p>
            {displayedPrice.secondary && (
              <p className="text-xs text-white/70">{displayedPrice.secondary}</p>
            )}
          </div>
        </Link>

        <div className="p-5">
          <div className={hasSummary ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]" : ""}>
            <div className="flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={href} className="text-xl font-semibold text-foreground hover:text-primary">
                      {`${boat.year} ${boat.make} ${boat.model}`}
                    </Link>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-foreground/70">
                      {boat.specs.loa && (
                        <span className="inline-flex items-center gap-1.5">
                          <Ruler className="h-4 w-4 text-primary" />
                          {boat.specs.loa}ft
                        </span>
                      )}
                      {vesselType && (
                        <span className="inline-flex items-center gap-1.5">
                          <Sailboat className="h-4 w-4 text-primary" />
                          {vesselType}
                        </span>
                      )}
                      {boat.specs.rig_type && (
                        <span className="inline-flex items-center gap-1.5">
                          <Sailboat className="h-4 w-4 text-primary" />
                          {boat.specs.rig_type}
                        </span>
                      )}
                      {boat.location_text && (
                        <span
                          data-testid="boat-row-location"
                          className="inline-flex items-center gap-1.5 font-medium text-foreground/85"
                        >
                          <MapPin className="h-4 w-4 text-primary" />
                          {boat.location_text}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {boat.character_tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {boat.character_tags.slice(0, 5).map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {boat.source_name && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-foreground/55">
                    <span>{t("foundOn")}</span>
                    {safeSourceUrl ? (
                      <a
                        href={safeSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-foreground/75 hover:text-primary"
                      >
                        {boat.source_name}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="font-medium text-foreground/75">{boat.source_name}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onCompareToggle}
                  disabled={compareDisabled && !compareSelected}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    compareSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground/70 hover:border-primary hover:text-primary"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <GitCompareArrows className="h-4 w-4" />
                  {compareSelected ? t("addedToCompare") : t("compare")}
                </button>
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 rounded-full bg-primary-btn px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
                >
                  {t("viewListing")}
                </Link>
              </div>
            </div>

            {hasSummary && (
              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                  {t("listingSnapshot")}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-foreground/75">
                  {summary}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
