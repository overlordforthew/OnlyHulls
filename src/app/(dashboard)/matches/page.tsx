"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BoatCard from "@/components/BoatCard";

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
  currency: string;
  location_text: string | null;
  slug: string | null;
  is_sample: boolean;
  hero_url: string | null;
  specs: { loa?: number; rig_type?: string };
  character_tags: string[];
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetchMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function fetchMatches() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches?page=${page}&limit=20`);
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
        setMatches((prev) => prev.filter((m) => m.match_id !== matchId));
      }
    } catch {
      // Silently fail — the UI state is unchanged, user can retry
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
          Answer a few questions about your budget, boat type, and cruising plans
          so we can match you with boats.
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Matches</h1>
          <p className="text-sm text-foreground/60">
            {total} boats matched to your profile
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button
            onClick={() => { setError(null); fetchMatches(); }}
            className="ml-3 font-medium text-red-300 underline hover:text-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {matches.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg text-foreground/60">
            No matches yet. Check back once sellers list their boats!
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((m) => (
              <div key={m.match_id} className="space-y-3">
                <BoatCard
                  boat={{
                    id: m.boat_id,
                    make: m.make,
                    model: m.model,
                    year: m.year,
                    asking_price: m.asking_price,
                    currency: m.currency,
                    location_text: m.location_text,
                    slug: m.slug,
                    is_sample: m.is_sample,
                    hero_url: m.hero_url,
                    specs: m.specs,
                    character_tags: m.character_tags,
                  }}
                  matchScore={m.score}
                  showActions
                  onSave={() => handleAction(m.match_id, "interested")}
                  onDismiss={() => handleAction(m.match_id, "passed")}
                  onConnect={() =>
                    router.push(`/boats/${m.slug || m.boat_id}?connect=true&matchId=${m.match_id}`)
                  }
                />
                {m.ai_verdict && m.ai_provider && (
                  <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-foreground/60">
                    <span className="rounded-full bg-foreground/5 px-2.5 py-1 font-medium text-foreground/75">
                      AI {m.ai_verdict.replace(/_/g, " ")}
                    </span>
                    {typeof m.ai_score === "number" && (
                      <span>LLM fit {Math.round(m.ai_score * 100)}%</span>
                    )}
                  </div>
                )}
                {m.explanation_summary && (
                  <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm">
                    <p className="font-medium text-foreground/90">{m.explanation_summary}</p>
                    {m.explanation_strengths && m.explanation_strengths.length > 0 && (
                      <p className="mt-2 text-foreground/65">
                        Strengths: {m.explanation_strengths.join(" ")}
                      </p>
                    )}
                    {m.explanation_risks && m.explanation_risks.length > 0 && (
                      <p className="mt-2 text-foreground/55">
                        Watchouts: {m.explanation_risks.join(" ")}
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
  );
}
