"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import BoatCard from "@/components/BoatCard";

interface Boat {
  id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  location_text: string | null;
  slug: string | null;
  is_sample: boolean;
  hero_url: string | null;
  specs: { loa?: number; rig_type?: string };
  character_tags: string[];
}

export default function BoatsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-foreground/60">Loading...</div>}>
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
  const [search, setSearch] = useState(initialQ);
  const [activeTag, setActiveTag] = useState(initialTag);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    minYear: "",
    maxYear: "",
    rigType: "",
  });

  useEffect(() => {
    fetchBoats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Re-fetch when URL params change (e.g. from homepage category click)
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const tag = searchParams.get("tag") || "";
    setSearch(q);
    setActiveTag(tag);
    setPage(1);
    fetchBoatsWithParams(q, tag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function fetchBoatsWithParams(q?: string, tag?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    const searchQ = q !== undefined ? q : search;
    const searchTag = tag !== undefined ? tag : activeTag;
    if (searchQ) params.set("q", searchQ);
    if (searchTag) params.set("tag", searchTag);
    params.set("page", String(page));
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.minYear) params.set("minYear", filters.minYear);
    if (filters.maxYear) params.set("maxYear", filters.maxYear);
    if (filters.rigType) params.set("rigType", filters.rigType);

    const res = await fetch(`/api/boats?${params}`);
    const data = await res.json();
    setBoats(data.boats || []);
    setTotal(data.total || 0);
    setLoading(false);
  }

  async function fetchBoats() {
    await fetchBoatsWithParams();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveTag("");
    setPage(1);
    fetchBoatsWithParams(search, "");
  }

  function clearTag() {
    setActiveTag("");
    fetchBoatsWithParams(search, "");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">⛵</span>
            <span className="text-xl font-bold text-primary">OnlyHulls</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-foreground/70 hover:text-foreground">
              Pricing
            </Link>
            <Link href="/sign-in" className="text-sm text-foreground/70 hover:text-foreground">
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold">Browse Boats</h1>

        {/* Active tag indicator */}
        {activeTag && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-foreground/60">Showing:</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {activeTag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              <button
                onClick={clearTag}
                className="ml-1 text-primary/60 hover:text-primary"
                aria-label="Clear tag filter"
              >
                ×
              </button>
            </span>
          </div>
        )}

        {/* Search + Filters */}
        <form onSubmit={handleSearch} className="mt-6 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search boats..."
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Search
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="number"
            placeholder="Min price"
            value={filters.minPrice}
            onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
            className="w-28 rounded-lg border border-border px-3 py-1.5 text-xs"
          />
          <input
            type="number"
            placeholder="Max price"
            value={filters.maxPrice}
            onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
            className="w-28 rounded-lg border border-border px-3 py-1.5 text-xs"
          />
          <input
            type="number"
            placeholder="Min year"
            value={filters.minYear}
            onChange={(e) => setFilters((f) => ({ ...f, minYear: e.target.value }))}
            className="w-24 rounded-lg border border-border px-3 py-1.5 text-xs"
          />
          <input
            type="number"
            placeholder="Max year"
            value={filters.maxYear}
            onChange={(e) => setFilters((f) => ({ ...f, maxYear: e.target.value }))}
            className="w-24 rounded-lg border border-border px-3 py-1.5 text-xs"
          />
          <select
            value={filters.rigType}
            onChange={(e) => setFilters((f) => ({ ...f, rigType: e.target.value }))}
            className="rounded-lg border border-border px-3 py-1.5 text-xs"
          >
            <option value="">All rigs</option>
            <option value="sloop">Sloop</option>
            <option value="cutter">Cutter</option>
            <option value="ketch">Ketch</option>
            <option value="yawl">Yawl</option>
            <option value="schooner">Schooner</option>
          </select>
          <button
            onClick={() => { setPage(1); fetchBoats(); }}
            className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium"
          >
            Apply Filters
          </button>
        </div>

        {/* Results */}
        {loading ? (
          <div className="mt-16 text-center text-foreground/60">Loading...</div>
        ) : boats.length === 0 ? (
          <div className="mt-16 text-center text-foreground/60">
            No boats found matching your criteria.
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-foreground/60">
              {total} boats found
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {boats.map((boat) => (
                <BoatCard key={boat.id} boat={boat} />
              ))}
            </div>
            {total > 20 && (
              <div className="mt-8 flex justify-center gap-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="py-2 text-sm text-foreground/60">
                  Page {page} of {Math.ceil(total / 20)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 20 >= total}
                  className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
