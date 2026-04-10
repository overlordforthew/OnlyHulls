"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import BoatCard from "@/components/BoatCard";
import CurrencySelector from "@/components/CurrencySelector";
import { buildBoatSearchParams } from "@/lib/search/boat-search";
import {
  normalizeSupportedCurrency,
  readPreferredCurrencyFromBrowser,
  type SupportedCurrency,
} from "@/lib/currency";
import {
  Search,
  SlidersHorizontal,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Bell,
  BookmarkPlus,
} from "lucide-react";

type SortField = "price" | "size" | "year" | "newest";
type SortDir = "asc" | "desc";

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
  specs: { loa?: number; rig_type?: string };
  character_tags: string[];
  source_site?: string | null;
  source_name?: string | null;
  source_url?: string | null;
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

  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialQ);
  const [activeTag, setActiveTag] = useState(initialTag);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("newest");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>(() =>
    initialCurrency || readPreferredCurrencyFromBrowser()
  );
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    minYear: "",
    maxYear: "",
    rigType: "",
  });

  const BATCH_SIZE = 30;
  const isLoggedIn = status === "authenticated";

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

  // Refetch when sort changes
  useEffect(() => {
    fetchBoats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDir, displayCurrency]);

  const buildParams = useCallback((q?: string, tag?: string, pageNum?: number) => {
    const params = new URLSearchParams();
    const searchQ = q !== undefined ? q : search;
    const searchTag = tag !== undefined ? tag : activeTag;
    if (searchQ) params.set("q", searchQ);
    if (searchTag) params.set("tag", searchTag);
    params.set("page", String(pageNum || page));
    params.set("limit", String(BATCH_SIZE));
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.minYear) params.set("minYear", filters.minYear);
    if (filters.maxYear) params.set("maxYear", filters.maxYear);
    if (filters.rigType) params.set("rigType", filters.rigType);
    if (displayCurrency !== "USD") params.set("currency", displayCurrency);
    params.set("sort", sortField);
    params.set("dir", sortDir);
    return params;
  }, [search, activeTag, page, filters, displayCurrency, sortField, sortDir]);

  async function fetchBoats(q?: string, tag?: string) {
    setLoading(true);
    setError(null);
    setPage(1);
    try {
      const params = buildParams(q, tag, 1);
      const res = await fetch(`/api/boats?${params}`);
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setBoats(data.boats || []);
      setTotal(data.total || 0);
    } catch {
      setError("Failed to load boats. Please try again.");
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
      setError("Failed to load more boats. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const q = searchParams.get("q") || "";
    const tag = searchParams.get("tag") || "";
    setSearch(q);
    setActiveTag(tag);
    fetchBoats(q, tag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveTag("");
    fetchBoats(search, "");
  }

  function clearTag() {
    setActiveTag("");
    fetchBoats(search, "");
  }

  const hasMore = boats.length < total;
  const currentSearchFilters = {
    search,
    tag: activeTag,
    minPrice: filters.minPrice || null,
    maxPrice: filters.maxPrice || null,
    minYear: filters.minYear || null,
    maxYear: filters.maxYear || null,
    rigType: filters.rigType || null,
    currency: displayCurrency,
    sort: sortField,
    dir: sortDir,
  };

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
        throw new Error(data.error || "Unable to save search.");
      }

      window.dispatchEvent(new CustomEvent("saved-searches:updated"));
      setSaveMessage(
        data.duplicate
          ? "This search is already saved."
          : "Search saved. New matching boats will show up in your alerts."
      );
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Unable to save search right now.");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div className="pb-16">
      {/* Page Header + Search */}
      <div className="border-b border-border bg-surface/50">
        <div className="mx-auto max-w-7xl px-5 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Browse Boats</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {!loading && (
                  <p className="text-sm text-text-secondary">
                    {total} boats
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
                    ? "Saving..."
                    : isLoggedIn
                      ? "Save Search"
                      : "Sign In to Save"}
                </button>
              </div>
              {saveMessage && (
                <p className="mt-2 text-sm text-primary">
                  {saveMessage}
                </p>
              )}
            </div>

            <form onSubmit={handleSearch} className="flex max-w-md flex-1 gap-2 sm:justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search boats..."
                  className={`${inputClass} w-full pl-9`}
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-primary-btn px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
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
                <button onClick={clearTag} className="text-primary/60 hover:text-primary" aria-label="Clear filter">
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
                placeholder="Min price"
                value={filters.minPrice}
                onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
                className={`${inputClass} w-28`}
              />
              <input
                type="number"
                placeholder="Max price"
                value={filters.maxPrice}
                onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
                className={`${inputClass} w-28`}
              />
              <input
                type="number"
                placeholder="Min year"
                value={filters.minYear}
                onChange={(e) => setFilters((f) => ({ ...f, minYear: e.target.value }))}
                className={`${inputClass} w-28 min-w-[7rem]`}
              />
              <input
                type="number"
                placeholder="Max year"
                value={filters.maxYear}
                onChange={(e) => setFilters((f) => ({ ...f, maxYear: e.target.value }))}
                className={`${inputClass} w-28 min-w-[7rem]`}
              />
              <select
                value={filters.rigType}
                onChange={(e) => setFilters((f) => ({ ...f, rigType: e.target.value }))}
                className={inputClass}
              >
                <option value="">All rigs</option>
                <option value="sloop">Sloop</option>
                <option value="cutter">Cutter</option>
                <option value="ketch">Ketch</option>
                <option value="yawl">Yawl</option>
                <option value="schooner">Schooner</option>
              </select>
              <button
                onClick={() => fetchBoats()}
                className="rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white hover:bg-primary-light"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sort Bar */}
      <div className="border-b border-border bg-surface/30">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-5 py-2">
          <span className="mr-1 text-xs text-text-tertiary whitespace-nowrap">Sort by</span>
          {(["price", "size", "year", "newest"] as SortField[]).map((field) => {
            const active = sortField === field;
            const labels: Record<SortField, string> = {
              price: "Price", size: "Size", year: "Year", newest: "Newest",
            };
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
                {labels[field]}
                {active ? (
                  sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-30" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-7xl px-5 pt-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
            <button
              onClick={() => { setError(null); fetchBoats(); }}
              className="ml-3 font-medium text-red-300 underline hover:text-red-200"
            >
              Retry
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
          <div className="py-20 text-center">
            <p className="text-4xl">🌊</p>
            <p className="mt-4 text-lg font-medium text-foreground">No hulls found</p>
            <p className="mt-1 text-sm text-text-secondary">
              Try a different search or adjust your filters.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {boats.map((boat) => (
                <BoatCard key={boat.id} boat={boat} displayCurrency={displayCurrency} />
              ))}
            </div>

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
                      Loading...
                    </span>
                  ) : (
                    `Show More (${total - boats.length} remaining)`
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
