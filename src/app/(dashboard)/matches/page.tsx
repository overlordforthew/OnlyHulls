"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Grid2X2, Heart, List, MapPin, MessageCircle, Ruler, Sailboat, X } from "lucide-react";
import BoatCard from "@/components/BoatCard";
import CurrencySelector from "@/components/CurrencySelector";
import {
  getDisplayedPrice,
  readPreferredCurrencyFromBrowser,
  type SupportedCurrency,
} from "@/lib/currency";
import { isLocalMediaUrl } from "@/lib/media";

interface Match {
  match_id: string;
  score: number;
  buyer_action: string;
  explanation_summary?: string | null;
  explanation_strengths?: string[] | null;
  explanation_risks?: string[] | null;
  explanation_confidence?: number | null;
  explanation_provider?: string | null;
  ai_score?: number | null;
  ai_verdict?: string | null;
  ai_provider?: string | null;
  boat_id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  asking_price_usd?: number | null;
  currency: string;
  location_text: string | null;
  slug: string | null;
  is_sample: boolean;
  source_site?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  seller_subscription_tier?: string | null;
  hero_url: string | null;
  specs: { loa?: number; rig_type?: string };
  character_tags: string[];
}

type MatchSort = "match" | "price" | "year" | "size" | "newest";
type SortDir = "asc" | "desc";
type ViewMode = "grid" | "rows";

const MATCHES_PAGE_SIZE = 12;

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<MatchSort>("match");
  const [dir, setDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>(() =>
    readPreferredCurrencyFromBrowser()
  );
  const router = useRouter();

  useEffect(() => {
    const savedView = window.localStorage.getItem("matches_view_mode");
    if (savedView === "grid" || savedView === "rows") {
      setViewMode(savedView);
    }
  }, []);

  useEffect(() => {
    void fetchMatches(true, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, dir]);

  async function fetchMatches(reset = false, nextPage = page) {
    if (reset) {
      setLoading(true);
      setMatches([]);
      setPage(1);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const res = await fetch(
        `/api/matches?page=${nextPage}&limit=${MATCHES_PAGE_SIZE}&sort=${sort}&dir=${dir}`
      );
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      const nextMatches = data.matches || [];
      setMatches((prev) => (reset ? nextMatches : [...prev, ...nextMatches]));
      setTotal(data.total || 0);
      setNeedsProfile(data.needsProfile || false);
      setPage(nextPage);
    } catch {
      setError("Failed to load matches. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function handleAction(matchId: string, action: string) {
    try {
      const res = await fetch(`/api/matches/${matchId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Action failed");
      if (action === "passed") {
        setMatches((prev) => prev.filter((match) => match.match_id !== matchId));
      }
    } catch {
      // Keep the current state and let the user retry.
    }
  }

  const hasMore = matches.length < total;

  function handleViewMode(nextView: ViewMode) {
    setViewMode(nextView);
    window.localStorage.setItem("matches_view_mode", nextView);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-foreground/60">Loading your matches...</p>
      </div>
    );
  }

  if (needsProfile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Build Your Profile First</h1>
        <p className="mt-3 text-foreground/60">
          Answer a few questions about your budget, boat type, and cruising plans so we can match
          you with boats.
        </p>
        <button
          onClick={() => router.push("/onboarding/profile")}
          className="mt-8 rounded-full bg-primary-btn px-8 py-3 text-lg font-medium text-white hover:bg-primary-dark"
        >
          Build Buyer Profile
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Matches</h1>
          <p className="text-sm text-foreground/60">{total} boats matched to your profile</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CurrencySelector
            id="matches-currency"
            value={displayCurrency}
            onChange={setDisplayCurrency}
          />
          <div className="inline-flex rounded-full border border-border bg-surface p-1">
            <button
              type="button"
              onClick={() => handleViewMode("grid")}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                viewMode === "grid"
                  ? "bg-primary-btn text-white"
                  : "text-foreground/65 hover:text-foreground"
              }`}
            >
              <Grid2X2 className="h-4 w-4" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => handleViewMode("rows")}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                viewMode === "rows"
                  ? "bg-primary-btn text-white"
                  : "text-foreground/65 hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
              Rows
            </button>
          </div>
          <label htmlFor="matches-sort" className="text-sm text-foreground/60">
            Sort by
          </label>
          <select
            id="matches-sort"
            value={`${sort}:${dir}`}
            onChange={(event) => {
              const [nextSort, nextDir] = event.target.value.split(":") as [MatchSort, SortDir];
              setSort(nextSort);
              setDir(nextDir);
              setPage(1);
            }}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground"
          >
            <option value="match:desc">Best match</option>
            <option value="price:asc">Price: low to high</option>
            <option value="price:desc">Price: high to low</option>
            <option value="size:asc">Size: small to large</option>
            <option value="size:desc">Size: large to small</option>
            <option value="year:desc">Year: newest first</option>
            <option value="year:asc">Year: oldest first</option>
            <option value="newest:desc">Recently listed</option>
            <option value="newest:asc">Oldest listings</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button
            onClick={() => {
              setError(null);
              fetchMatches();
            }}
            className="ml-3 font-medium text-red-300 underline hover:text-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {matches.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg text-foreground/60">
            No matches yet. Check back once sellers list their boats.
          </p>
        </div>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((match) => (
                <div key={match.match_id} className="space-y-3">
                  <BoatCard
                    boat={{
                      id: match.boat_id,
                      make: match.make,
                      model: match.model,
                      year: match.year,
                      asking_price: match.asking_price,
                      asking_price_usd: match.asking_price_usd,
                      currency: match.currency,
                      location_text: match.location_text,
                      slug: match.slug,
                      is_sample: match.is_sample,
                      source_site: match.source_site,
                      source_name: match.source_name,
                      source_url: match.source_url,
                      seller_subscription_tier: match.seller_subscription_tier,
                      hero_url: match.hero_url,
                      specs: match.specs,
                      character_tags: match.character_tags,
                    }}
                    displayCurrency={displayCurrency}
                    matchScore={match.score}
                    showActions
                    onSave={() => handleAction(match.match_id, "interested")}
                    onDismiss={() => handleAction(match.match_id, "passed")}
                    onConnect={() =>
                      router.push(
                        `/boats/${match.slug || match.boat_id}?connect=true&matchId=${match.match_id}`
                      )
                    }
                  />
                  {match.ai_verdict && match.ai_provider && (
                    <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-foreground/60">
                      <span className="rounded-full bg-foreground/5 px-2.5 py-1 font-medium text-foreground/75">
                        AI {match.ai_verdict.replace(/_/g, " ")}
                      </span>
                      {typeof match.ai_score === "number" && (
                        <span>LLM fit {Math.round(match.ai_score * 100)}%</span>
                      )}
                    </div>
                  )}
                  {match.explanation_summary && (
                    <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm">
                      <p className="font-medium text-foreground/90">{match.explanation_summary}</p>
                      {match.explanation_strengths && match.explanation_strengths.length > 0 && (
                        <p className="mt-2 text-foreground/65">
                          Strengths: {match.explanation_strengths.join(" ")}
                        </p>
                      )}
                      {match.explanation_risks && match.explanation_risks.length > 0 && (
                        <p className="mt-2 text-foreground/55">
                          Watchouts: {match.explanation_risks.join(" ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {matches.map((match) => (
                <MatchRow
                  key={match.match_id}
                  match={match}
                  displayCurrency={displayCurrency}
                  onSave={() => handleAction(match.match_id, "interested")}
                  onDismiss={() => handleAction(match.match_id, "passed")}
                  onConnect={() =>
                    router.push(`/boats/${match.slug || match.boat_id}?connect=true&matchId=${match.match_id}`)
                  }
                />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => void fetchMatches(false, page + 1)}
                disabled={loadingMore}
                className="rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loadingMore ? "Loading more..." : `See more matches (${Math.max(total - matches.length, 0)} left)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MatchRow({
  match,
  displayCurrency,
  onSave,
  onDismiss,
  onConnect,
}: {
  match: Match;
  displayCurrency: SupportedCurrency;
  onSave: () => void;
  onDismiss: () => void;
  onConnect: () => void;
}) {
  const href = `/boats/${match.slug || match.boat_id}`;
  const displayedPrice = getDisplayedPrice({
    amount: match.asking_price,
    nativeCurrency: match.currency,
    amountUsd: match.asking_price_usd,
    preferredCurrency: displayCurrency,
  });
  const sizeLabel =
    typeof match.specs.loa === "number"
      ? `${match.specs.loa}ft`
      : typeof match.specs.loa === "string"
        ? match.specs.loa
        : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
        <Link href={href} className="relative block min-h-[220px] bg-muted">
          {match.hero_url ? (
            <Image
              src={match.hero_url}
              alt={`${match.year} ${match.make} ${match.model}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 280px"
              unoptimized={!isLocalMediaUrl(match.hero_url)}
              quality={isLocalMediaUrl(match.hero_url) ? 84 : undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-elevated text-5xl opacity-20">
              ⛵
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute left-4 top-4 rounded-full bg-primary-btn/90 px-3 py-1 text-xs font-semibold text-white">
            {Math.round(match.score * 100)}% Match
          </div>
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
                  {`${match.year} ${match.make} ${match.model}`}
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-foreground/65">
                  {sizeLabel && (
                    <span className="inline-flex items-center gap-1.5">
                      <Ruler className="h-4 w-4" />
                      {sizeLabel}
                    </span>
                  )}
                  {match.specs.rig_type && (
                    <span className="inline-flex items-center gap-1.5">
                      <Sailboat className="h-4 w-4" />
                      {match.specs.rig_type}
                    </span>
                  )}
                  {match.location_text && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {match.location_text}
                    </span>
                  )}
                </div>
              </div>

              {match.ai_verdict && (
                <div className="rounded-full bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground/75">
                  AI {match.ai_verdict.replace(/_/g, " ")}
                  {typeof match.ai_score === "number" ? ` · ${Math.round(match.ai_score * 100)}%` : ""}
                </div>
              )}
            </div>

            {match.explanation_summary && (
              <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm">
                <p className="font-medium text-foreground/90">{match.explanation_summary}</p>
                {match.explanation_strengths && match.explanation_strengths.length > 0 && (
                  <p className="mt-2 text-foreground/65">
                    Strengths: {match.explanation_strengths.join(" ")}
                  </p>
                )}
                {match.explanation_risks && match.explanation_risks.length > 0 && (
                  <p className="mt-2 text-foreground/55">
                    Watchouts: {match.explanation_risks.join(" ")}
                  </p>
                )}
              </div>
            )}

            {match.character_tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {match.character_tags.slice(0, 5).map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-primary">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {match.source_name && (
              <div className="mt-4 flex items-center gap-2 text-sm text-foreground/55">
                <span>Found on</span>
                {match.source_url ? (
                  <a
                    href={match.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-foreground/75 hover:text-primary"
                  >
                    {match.source_name}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="font-medium text-foreground/75">{match.source_name}</span>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:border-primary hover:text-primary"
            >
              <Heart className="h-4 w-4" />
              Save
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              <X className="h-4 w-4" />
              Pass
            </button>
            <button
              type="button"
              onClick={onConnect}
              className="inline-flex items-center gap-2 rounded-full bg-accent-btn px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-light"
            >
              <MessageCircle className="h-4 w-4" />
              Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
