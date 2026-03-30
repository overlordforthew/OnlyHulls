"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import BoatCard from "@/components/BoatCard";
import { Search, SlidersHorizontal, X, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

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
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const initialTag = searchParams.get("tag") || "";

  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(initialQ);
  const [activeTag, setActiveTag] = useState(initialTag);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("price");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    minYear: "",
    maxYear: "",
    rigType: "",
  });

  const BATCH_SIZE = 30;

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
  }, [sortField, sortDir]);

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
    params.set("sort", sortField);
    params.set("dir", sortDir);
    return params;
  }, [search, activeTag, page, filters, sortField, sortDir]);

  async function fetchBoats(q?: string, tag?: string) {
    setLoading(true);
    setPage(1);
    const params = buildParams(q, tag, 1);
    const res = await fetch(`/api/boats?${params}`);
    const data = await res.json();
    setBoats(data.boats || []);
    setTotal(data.total || 0);
    setLoading(false);
  }

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    const params = buildParams(undefined, undefined, nextPage);
    const res = await fetch(`/api/boats?${params}`);
    const data = await res.json();
    setBoats((prev) => [...prev, ...(data.boats || [])]);
    setPage(nextPage);
    setLoadingMore(false);
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

  const inputClass =
    "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <div className="pb-16">
      {/* Page Header + Search */}
      <div className="border-b border-border bg-surface/50">
        <div className="mx-auto max-w-7xl px-5 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Browse Boats</h1>
              {!loading && (
                <p className="mt-1 text-sm text-text-secondary">
                  {total} boats
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
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light"
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
                className={`${inputClass} w-24`}
              />
              <input
                type="number"
                placeholder="Max year"
                value={filters.maxYear}
                onChange={(e) => setFilters((f) => ({ ...f, maxYear: e.target.value }))}
                className={`${inputClass} w-24`}
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
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light"
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
                <BoatCard key={boat.id} boat={boat} />
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
