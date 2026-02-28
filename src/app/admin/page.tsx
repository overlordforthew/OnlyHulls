"use client";

import { useState, useEffect } from "react";

interface Stats {
  totalUsers: number;
  activeListings: number;
  pendingListings: number;
  totalMatches: number;
  totalIntroductions: number;
}

interface PendingListing {
  id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  location_text: string | null;
  seller_email: string;
  created_at: string;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/admin/listings?status=pending_review").then((r) => r.json()),
    ]).then(([s, p]) => {
      setStats(s);
      setPending(p.listings || []);
      setLoading(false);
    });
  }, []);

  async function handleApprove(id: string) {
    await fetch(`/api/admin/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    setPending((prev) => prev.filter((l) => l.id !== id));
    if (stats) setStats({ ...stats, pendingListings: stats.pendingListings - 1, activeListings: stats.activeListings + 1 });
  }

  async function handleReject(id: string) {
    await fetch(`/api/admin/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    setPending((prev) => prev.filter((l) => l.id !== id));
    if (stats) setStats({ ...stats, pendingListings: stats.pendingListings - 1 });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-foreground/60">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Stats */}
      {stats && (
        <div className="mt-8 grid gap-4 sm:grid-cols-5">
          <StatCard label="Total Users" value={stats.totalUsers} />
          <StatCard label="Active Listings" value={stats.activeListings} />
          <StatCard label="Pending Review" value={stats.pendingListings} highlight />
          <StatCard label="Total Matches" value={stats.totalMatches} />
          <StatCard label="Introductions" value={stats.totalIntroductions} />
        </div>
      )}

      {/* Moderation Queue */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold">
          Moderation Queue ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-4 text-foreground/60">No listings pending review.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {pending.map((listing) => (
              <div
                key={listing.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium">
                    {listing.year} {listing.make} {listing.model}
                  </p>
                  <p className="text-sm text-foreground/60">
                    ${listing.asking_price.toLocaleString()} {listing.currency}
                    {listing.location_text && ` — ${listing.location_text}`}
                  </p>
                  <p className="text-xs text-foreground/40">
                    By {listing.seller_email} —{" "}
                    {new Date(listing.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(listing.id)}
                    className="rounded-full bg-green-600 px-4 py-1.5 text-sm text-white hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(listing.id)}
                    className="rounded-full bg-red-500 px-4 py-1.5 text-sm text-white hover:bg-red-600"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? "border-accent bg-accent/10" : "border-border"
      }`}
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-foreground/60">{label}</p>
    </div>
  );
}
