"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BoatCard from "@/components/BoatCard";

interface Match {
  match_id: string;
  score: number;
  buyer_action: string;
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
    const res = await fetch(`/api/matches?page=${page}&limit=20`);
    const data = await res.json();
    setMatches(data.matches || []);
    setTotal(data.total || 0);
    setNeedsProfile(data.needsProfile || false);
    setLoading(false);
  }

  async function handleAction(matchId: string, action: string) {
    await fetch(`/api/matches/${matchId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (action === "passed") {
      setMatches((prev) => prev.filter((m) => m.match_id !== matchId));
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
          Chat with our AI to create your buyer profile, then we&apos;ll match
          you with boats.
        </p>
        <button
          onClick={() => router.push("/onboarding/profile")}
          className="mt-8 rounded-full bg-primary-btn px-8 py-3 text-lg font-medium text-white hover:bg-primary-dark"
        >
          Start AI Profile Chat
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
              <BoatCard
                key={m.match_id}
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
                  router.push(`/boats/${m.slug || m.boat_id}?connect=true`)
                }
              />
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
