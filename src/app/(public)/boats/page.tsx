"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import BoatCard from "@/components/BoatCard";
import CurrencySelector from "@/components/CurrencySelector";
import { useCompareBoats } from "@/hooks/useCompareBoats";
import SeoHubLinks from "@/components/seo/SeoHubLinks";
import { buildBoatSearchParams } from "@/lib/search/boat-search";
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
  MapPin,
  Ruler,
  Sailboat,
} from "lucide-react";

type SortField = "price" | "size" | "year" | "newest";
type SortDir = "asc" | "desc";
type ViewMode = "grid" | "rows";
type SearchParamReader = { get: (key: string) => string | null };

interface Boat {
  id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  asking_price_usd: number | null;
  location_text: string | null;
  slug: string | null;
  is_sample: boolean;
  hero_url: string | null;
  specs: { loa?: number; rig_type?: string; vessel_type?: string };
  character_tags: string[];
  source_site?: string | null;
  source_name?: string | null;
  source_url?: string | null;
}

interface FilterState {
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  rigType: string;
  hullType: string;
}

const EMPTY_FILTERS: FilterState = {
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  rigType: "",
  hullType: "",
};

function normalizeSortField(value: string | null): SortField {
  return value === "price" || value === "size" || value === "year" || value === "newest"
    ? value
    : "newest";
}

function normalizeSortDir(value: string | null, field: SortField): SortDir {
  if (value === "asc" || value === "desc") return value;
  return field === "newest" ? "desc" : "asc";
}

function filtersFromParams(searchParams: SearchParamReader): FilterState {
  return {
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    minYear: searchParams.get("minYear") || "",
    maxYear: searchParams.get("maxYear") || "",
    rigType: searchParams.get("rigType") || "",
    hullType: searchParams.get("hullType") || "",
  };
}

function formatBoatType(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function BoatsPage() {
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
      <BoatsPageInner />
    </Suspense>
  );
}

function BoatsPageInner() {
  const t = useTranslations("boatsPage");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const initialQ = searchParams.get("q") || "";
  const initialTag = searchParams.get("tag") || "";
  const requestedCurrency = searchParams.get("currency");
  const initialCurrency = requestedCurrency
    ? normalizeSupportedCurrency(requestedCurrency)
    : null;
  const initialSortField = normalizeSortField(searchParams.get("sort"));
  const initialSortDir = normalizeSortDir(searchParams.get("dir"), initialSortField);
  const initialFilters = filtersFromParams(searchParams);

  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(initialQ);
  const [search, setSearch] = useState(initialQ);
  const [activeTag, setActiveTag] = useState(initialTag);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>(() =>
    initialCurrency || readPreferredCurrencyFromBrowser()
  );
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const { compareCount, isCompared, toggleBoat, maxCompareBoats } = useCompareBoats();
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(initialFilters);

  const BATCH_SIZE = 30;
  const isLoggedIn = status === "authenticated";
  const compareReady = compareCount > 0;
  const compareCountLabel = t("compareFilled", { count: compareCount });

  useEffect(() => {
    const savedView = window.localStorage.getItem("boats_view_mode");
    if (savedView === "grid" || savedView === "rows") {
      setViewMode(savedView);
    }
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
    setViewMode(nextView);
    window.localStorage.setItem("boats_view_mode", nextView);
  }

  function clearSearchCriteria() {
    setSearchInput("");
    setSearch("");
    setActiveTag("");
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSaveMessage(null);
    router.push("/boats");
  }

  // Refetch when sort changes
  useEffect(() => {
    fetchBoats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDir, displayCurrency]);

  const buildParams = useCallback((q?: string, tag?: string, pageNum?: number, filterState?: FilterState) => {
    const params = new URLSearchParams();
    const searchQ = q !== undefined ? q : search;
    const searchTag = tag !== undefined ? tag : activeTag;
    const currentFilters = filterState ?? appliedFilters;
    if (searchQ) params.set("q", searchQ);
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
  }, [search, activeTag, page, appliedFilters, displayCurrency, sortField, sortDir]);

  async function fetchBoats(q?: string, tag?: string, filterState?: FilterState) {
    setLoading(true);
    setError(null);
    setPage(1);
    const nextSearch = q !== undefined ? q : search;
    const nextTag = tag !== undefined ? tag : activeTag;
    const nextFilters = filterState ?? appliedFilters;
    try {
      const params = buildParams(nextSearch, nextTag, 1, nextFilters);
      const res = await fetch(`/api/boats?${params}`);
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setBoats(data.boats || []);
      setTotal(data.total || 0);
      setSearch(nextSearch);
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
    const q = searchParams.get("q") || "";
    const tag = searchParams.get("tag") || "";
    const nextFilters = filtersFromParams(searchParams);
    setSearchInput(q);
    setSearch(q);
    setActiveTag(tag);
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    fetchBoats(q, tag, nextFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchBoats(searchInput, "", filters);
  }

  function clearTag() {
    fetchBoats(search, "", appliedFilters);
  }

  const hasMore = boats.length < total;
  const currentSearchFilters = {
    search,
    tag: activeTag,
    minPrice: appliedFilters.minPrice || null,
    maxPrice: appliedFilters.maxPrice || null,
    minYear: appliedFilters.minYear || null,
    maxYear: appliedFilters.maxYear || null,
    rigType: appliedFilters.rigType || null,
    hullType: appliedFilters.hullType || null,
    currency: displayCurrency,
    sort: sortField,
    dir: sortDir,
  };
  const hasActiveSearchCriteria =
    search.trim().length > 0 ||
    activeTag.trim().length > 0 ||
    Boolean(
        appliedFilters.minPrice ||
        appliedFilters.maxPrice ||
        appliedFilters.minYear ||
        appliedFilters.maxYear ||
        appliedFilters.rigType ||
        appliedFilters.hullType
      );

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
              <h1 className="text-2xl font-bold">{t("heading")}</h1>
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

            <form onSubmit={handleSearch} className="flex max-w-md flex-1 gap-2 sm:justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className={`${inputClass} w-full pl-9`}
                />
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

          {/* Active tag */}
          {activeTag && (
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {activeTag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                <button onClick={clearTag} className="text-primary/60 hover:text-primary" aria-label={t("clearFilter")}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
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
                onClick={() => fetchBoats(searchInput, activeTag, filters)}
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
          </div>
        </div>
      </div>

      {!hasActiveSearchCriteria && (
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
            {viewMode === "grid" ? (
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

        <div className="flex flex-col justify-between p-5">
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
      </div>
    </div>
  );
}
