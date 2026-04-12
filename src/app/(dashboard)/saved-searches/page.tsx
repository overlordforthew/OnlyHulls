"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Bookmark, ExternalLink, RefreshCw, Trash2 } from "lucide-react";

interface SavedSearch {
  id: string;
  name: string;
  browseUrl: string;
  newResults: number;
  latestNewBoats: Array<{
    id: string;
    slug: string | null;
    title: string;
    price: number;
    currency: string;
    locationText: string | null;
    heroUrl: string | null;
  }>;
  totalResults: number;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string;
  filters: {
    search: string;
    minPrice: string | null;
    maxPrice: string | null;
    minYear: string | null;
    maxYear: string | null;
    rigType: string | null;
    hullType: string | null;
    tag: string | null;
    sort: string;
    dir: string;
  };
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
  }
}

function describeFilters(search: SavedSearch) {
  const chips: string[] = [];

  if (search.filters.search) chips.push(`Query: ${search.filters.search}`);
  if (search.filters.tag) chips.push(`Tag: ${search.filters.tag.replace(/[-_]+/g, " ")}`);
  if (search.filters.rigType) chips.push(`Rig: ${search.filters.rigType}`);
  if (search.filters.hullType) chips.push(`Hull: ${search.filters.hullType}`);
  if (search.filters.minPrice || search.filters.maxPrice) {
    chips.push(
      `Price: ${search.filters.minPrice ? `$${search.filters.minPrice}` : "Any"} - ${search.filters.maxPrice ? `$${search.filters.maxPrice}` : "Any"}`
    );
  }
  if (search.filters.minYear || search.filters.maxYear) {
    chips.push(
      `Year: ${search.filters.minYear || "Any"} - ${search.filters.maxYear || "Any"}`
    );
  }
  chips.push(`Sort: ${search.filters.sort} ${search.filters.dir}`);

  return chips;
}

export default function SavedSearchesPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void loadSavedSearches();
  }, []);

  async function loadSavedSearches() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-searches");
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setSearches(data.searches || []);
    } catch {
      setError("Failed to load saved searches. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function markSeen(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Unable to update saved search.");
      const data = await res.json();
      setSearches((prev) => prev.map((search) => (
        search.id === id ? data.savedSearch : search
      )));
      window.dispatchEvent(new CustomEvent("saved-searches:updated"));
    } catch {
      setError("Failed to mark alerts as seen. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeSearch(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Unable to delete saved search.");
      setSearches((prev) => prev.filter((search) => search.id !== id));
      window.dispatchEvent(new CustomEvent("saved-searches:updated"));
    } catch {
      setError("Failed to delete saved search. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const searchesWithUpdates = searches.filter((search) => search.newResults > 0).length;
  const totalNewResults = searches.reduce((sum, search) => sum + search.newResults, 0);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-12">
        <p className="text-text-secondary">Loading saved searches...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Bell className="h-3.5 w-3.5" />
            In-App Alerts
          </div>
          <h1 className="mt-4 text-3xl font-bold">Saved Searches</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Track the browse views that matter, then check back here for fresh boats even before email delivery is turned on.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-background/40 px-5 py-4 text-sm">
          <p className="text-text-secondary">{searches.length} saved searches</p>
          <p className="mt-1 font-semibold text-foreground">{searchesWithUpdates} searches with updates</p>
          <p className="mt-1 text-primary">{totalNewResults} new boats across your alerts</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/boats"
          className="rounded-full bg-primary-btn px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light"
        >
          Browse Boats
        </Link>
        <button
          onClick={() => void loadSavedSearches()}
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Alerts
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {searches.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
          <Bookmark className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-semibold">No saved searches yet</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Save a browse view from the boats page and OnlyHulls will keep track of new matching inventory here.
          </p>
          <Link
            href="/boats"
            className="mt-6 inline-flex rounded-full bg-primary-btn px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light"
          >
            Start Browsing
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {searches.map((search) => (
            <div key={search.id} className="rounded-3xl border border-border bg-surface p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{search.name}</h2>
                    {search.newResults > 0 ? (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {search.newResults} new
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-text-secondary">
                        Up to date
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    {search.totalResults} active boats match this search. Last checked {formatTimestamp(search.lastCheckedAt)}.
                  </p>
                  {search.latestNewBoats.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Fresh boats for this search
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {search.latestNewBoats.map((boat) => (
                          <Link
                            key={`${search.id}-${boat.id}`}
                            href={`/boats/${boat.slug || boat.id}`}
                            className="rounded-2xl border border-border bg-background/50 p-3 transition-all hover:border-primary hover:bg-background/70"
                          >
                            <p className="line-clamp-2 text-sm font-semibold text-foreground">
                              {boat.title}
                            </p>
                            <p className="mt-2 text-sm font-medium text-primary">
                              {formatCurrency(boat.price, boat.currency)}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {boat.locationText || "Location being refined"}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {describeFilters(search).map((chip) => (
                      <span
                        key={`${search.id}-${chip}`}
                        className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 lg:justify-end">
                  <Link
                    href={search.browseUrl}
                    className="inline-flex items-center gap-2 rounded-full bg-primary-btn px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light"
                  >
                    View Results
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => void markSeen(search.id)}
                    disabled={busyId === search.id}
                    className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    {busyId === search.id ? "Updating..." : "Mark Seen"}
                  </button>
                  <button
                    onClick={() => void removeSearch(search.id)}
                    disabled={busyId === search.id}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium text-red-400 transition-all hover:border-red-400/40 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-6 text-xs text-text-tertiary">
                <span>Created {formatTimestamp(search.createdAt)}</span>
                <span>Updated {formatTimestamp(search.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
