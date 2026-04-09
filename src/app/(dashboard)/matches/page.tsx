"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BoatCard from "@/components/BoatCard";
import CurrencySelector from "@/components/CurrencySelector";
import {
  readPreferredCurrencyFromBrowser,
  type SupportedCurrency,
} from "@/lib/currency";

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
  hero_url: string | null;
  specs: { loa?: number; rig_type?: string };
  character_tags: string[];
}

type MatchSort = "match" | "price" | "year" | "size" | "newest";
type SortDir = "asc" | "desc";

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<MatchSort>("match");
  const [dir, setDir] = useState<SortDir>("desc");
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>(() =>
    readPreferredCurrencyFromBrowser()
  );
  const router = useRouter();

  useEffect(() => {
    fetchMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, dir]);

  async function fetchMatches() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches?page=${page}&limit=20&sort=${sort}&dir=${dir}`);
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setMatches(data.matches || []);
      setTotal(data.total || 0);
      setNeedsProfile(data.needsProfile || false);
    } catch {
      setError("Failed to load matches. Please try again.");
    } finally {
      setLoading(false);
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
                    router.push(`/boats/${match.slug || match.boat_id}?connect=true&matchId=${match.match_id}`)
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

          {total > 20 && (
            <div className="mt-8 flex justify-center gap-4">
              <button
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                disabled={page === 1}
                className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-30"
              >
                Previous
              </button>
              <span className="py-2 text-sm text-foreground/60">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                onClick={() => setPage((currentPage) => currentPage + 1)}
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
  );
}
