"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

interface Stats {
  totalUsers: number;
  adminUsers: number;
  activeListings: number;
  pendingListings: number;
  totalMatches: number;
  totalIntroductions: number;
  funnel30d: {
    signups: number;
    buyerProfiles: number;
    savedSearches: number;
    sellerListings: number;
    matchInterested: number;
    connectRequests: number;
  };
  recentSignups: Array<{
    id: string;
    email: string;
    displayName: string | null;
    createdAt: string;
    emailVerified: boolean;
  }>;
  recentActivity: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    email: string | null;
    displayName: string | null;
    boatTitle: string | null;
    payload: Record<string, unknown>;
  }>;
  serviceStatus: {
    billingEnabled: boolean;
    emailEnabled: boolean;
    openAIEnabled: boolean;
    storageEnabled: boolean;
    meiliDocuments: number;
  };
}

interface PendingListing {
  id: string;
  slug: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  location_text: string | null;
  listing_source: string;
  seller_email: string;
  created_at: string;
}

function formatActivityTitle(activity: Stats["recentActivity"][number]) {
  switch (activity.eventType) {
    case "signup_created":
      return "New signup";
    case "buyer_profile_saved":
      return "Buyer profile updated";
    case "saved_search_created":
      return "Saved search created";
    case "seller_listing_created":
      return "Seller listing created";
    case "match_interested":
      return "Boat added to shortlist";
    case "connect_requested":
      return "Connect request sent";
    default:
      return activity.eventType.replace(/_/g, " ");
  }
}

function formatActivityDetail(activity: Stats["recentActivity"][number]) {
  const person = activity.displayName?.trim() || activity.email || "Unknown user";

  switch (activity.eventType) {
    case "signup_created":
      return `${person} created an account.`;
    case "buyer_profile_saved":
      return `${person} updated their buyer profile.`;
    case "saved_search_created": {
      const search = typeof activity.payload.search === "string" ? activity.payload.search : "";
      const tag = typeof activity.payload.tag === "string" ? activity.payload.tag : "";
      if (search) return `${person} saved a search for "${search}".`;
      if (tag) return `${person} saved the ${tag.replace(/[-_]+/g, " ")} browse view.`;
      return `${person} created a new saved search.`;
    }
    case "seller_listing_created":
      return activity.boatTitle
        ? `${person} created ${activity.boatTitle}.`
        : `${person} created a new seller listing.`;
    case "match_interested":
      return activity.boatTitle
        ? `${person} shortlisted ${activity.boatTitle}.`
        : `${person} shortlisted a boat.`;
    case "connect_requested":
      return activity.boatTitle
        ? `${person} requested a connection for ${activity.boatTitle}.`
        : `${person} requested a seller connection.`;
    default:
      return `${person} triggered ${activity.eventType.replace(/_/g, " ")}.`;
  }
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [statsRes, pendingRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/listings?status=pending_review"),
      ]);
      const [statsData, pendingData] = await Promise.all([
        statsRes.json(),
        pendingRes.json(),
      ]);

      setStats(statsData);
      setPending(pendingData.listings || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleApprove(id: string) {
    setActionLoading(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve listing");
      }
      setPending((prev) => prev.filter((listing) => listing.id !== id));
      setStats((prev) =>
        prev
          ? {
              ...prev,
              activeListings: prev.activeListings + 1,
              pendingListings: Math.max(0, prev.pendingListings - 1),
            }
          : prev
      );
      setMessage("Listing approved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to approve listing");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id: string) {
    setActionLoading(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject listing");
      }
      setPending((prev) => prev.filter((listing) => listing.id !== id));
      setStats((prev) =>
        prev
          ? {
              ...prev,
              pendingListings: Math.max(0, prev.pendingListings - 1),
            }
          : prev
      );
      setMessage("Listing rejected.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to reject listing");
    } finally {
      setActionLoading(null);
    }
  }

  async function runMaintenanceAction(
    actionKey: string,
    url: string,
    body: Record<string, unknown>,
    formatter: (data: Record<string, unknown>) => string,
    confirmMessage?: string
  ) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    setActionLoading(actionKey);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Maintenance action failed");
      }
      setMessage(formatter(data));
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Maintenance action failed");
    } finally {
      setActionLoading(null);
    }
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
      <p className="mt-2 text-sm text-foreground/60">
        Moderation, indexing, and match maintenance for the live marketplace.
      </p>
      {message && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-foreground/80">
          {message}
        </div>
      )}

      {stats && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Live Users"
              value={stats.totalUsers}
              info="Excludes system, browser, and internal test accounts so this reflects actual marketplace users."
            />
            <StatCard label="Admins" value={stats.adminUsers} />
            <StatCard label="Active Listings" value={stats.activeListings} />
            <StatCard label="Pending Review" value={stats.pendingListings} highlight />
            <StatCard label="Total Matches" value={stats.totalMatches} />
            <StatCard label="Introductions" value={stats.totalIntroductions} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <HealthCard
              label="Billing"
              value={stats.serviceStatus.billingEnabled ? "Configured" : "Missing"}
              healthy={stats.serviceStatus.billingEnabled}
            />
            <HealthCard
              label="Email"
              value={stats.serviceStatus.emailEnabled ? "Configured" : "Missing"}
              healthy={stats.serviceStatus.emailEnabled}
            />
            <HealthCard
              label="OpenAI"
              value={stats.serviceStatus.openAIEnabled ? "Configured" : "Fallback Only"}
              healthy={stats.serviceStatus.openAIEnabled}
            />
            <HealthCard
              label="Storage"
              value={stats.serviceStatus.storageEnabled ? "Configured" : "Missing"}
              healthy={stats.serviceStatus.storageEnabled}
            />
            <HealthCard
              label="Search Docs"
              value={`${stats.serviceStatus.meiliDocuments}`}
              healthy={stats.serviceStatus.meiliDocuments >= stats.activeListings}
            />
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Funnel - Last 30 Days</h2>
            <p className="mt-1 text-sm text-foreground/60">
              This is the actual product flow, not just raw account or listing totals.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <StatCard label="Signups" value={stats.funnel30d.signups} />
              <StatCard label="Buyer Profiles" value={stats.funnel30d.buyerProfiles} />
              <StatCard label="Saved Searches" value={stats.funnel30d.savedSearches} />
              <StatCard label="Seller Listings" value={stats.funnel30d.sellerListings} />
              <StatCard label="Shortlist Saves" value={stats.funnel30d.matchInterested} />
              <StatCard label="Connect Requests" value={stats.funnel30d.connectRequests} highlight />
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Recent Signups</h2>
            <p className="mt-1 text-sm text-foreground/60">
              The newest live user accounts, so you can quickly confirm whether people are joining.
            </p>
            {stats.recentSignups.length === 0 ? (
              <p className="mt-4 text-sm text-foreground/60">No live signups recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {stats.recentSignups.map((signup) => (
                  <div
                    key={signup.id}
                    className="flex flex-col justify-between gap-2 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-medium">
                        {signup.displayName?.trim() || "Unnamed user"}
                      </p>
                      <p className="text-sm text-foreground/70">{signup.email}</p>
                    </div>
                    <div className="text-sm text-foreground/60 sm:text-right">
                      <p>{new Date(signup.createdAt).toLocaleString()}</p>
                      <p className={signup.emailVerified ? "text-green-600" : "text-amber-500"}>
                        {signup.emailVerified ? "Email verified" : "Email not verified yet"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Live product activity across signups, saved searches, shortlists, and connect requests.
            </p>
            {stats.recentActivity.length === 0 ? (
              <p className="mt-4 text-sm text-foreground/60">No recent activity recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {stats.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex flex-col justify-between gap-2 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-medium">{formatActivityTitle(activity)}</p>
                      <p className="text-sm text-foreground/70">{formatActivityDetail(activity)}</p>
                    </div>
                    <div className="text-sm text-foreground/60 sm:text-right">
                      <p>{new Date(activity.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-8 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Maintenance</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <ActionWithInfo
            info="Publishes every listing still waiting for review. Use only after the entire queue has been manually checked."
          >
            <button
              onClick={() =>
                runMaintenanceAction(
                  "approve-all",
                  "/api/admin/listings/bulk",
                  { status: "active" },
                  (data) => `Approved ${data.updated || 0} pending listings.`,
                  `Approve all ${pending.length} pending listings and publish them live?`
                )
              }
              disabled={actionLoading === "approve-all" || pending.length === 0}
              className="rounded-full bg-primary-btn px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {actionLoading === "approve-all" ? "Approving..." : "Approve All Pending"}
            </button>
          </ActionWithInfo>
          <ActionWithInfo info="Rebuilds the Meilisearch boat index from the current active inventory. Use after large imports, cleanup, or moderation changes.">
            <button
              onClick={() =>
                runMaintenanceAction(
                  "reindex-search",
                  "/api/admin/maintenance/reindex-search",
                  {},
                  (data) => `Reindexed ${data.indexed || 0} active boats into search.`
                )
              }
              disabled={actionLoading === "reindex-search"}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              {actionLoading === "reindex-search" ? "Reindexing..." : "Rebuild Search Index"}
            </button>
          </ActionWithInfo>
          <ActionWithInfo info="Recomputes saved buyer matches against the current inventory and matching rules. Use after major profile, inventory, or matching logic changes.">
            <button
              onClick={() =>
                runMaintenanceAction(
                  "backfill-matches",
                  "/api/admin/maintenance/backfill-matches",
                  {},
                  (data) =>
                    `Processed ${data.totalProcessed || 0} buyer profiles, skipped ${data.totalSkipped || 0}, total matches ${data.totalMatches || 0}.`
                )
              }
              disabled={actionLoading === "backfill-matches"}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              {actionLoading === "backfill-matches" ? "Backfilling..." : "Backfill Matches"}
            </button>
          </ActionWithInfo>
          <ActionWithInfo info="Reloads the dashboard stats and moderation queue without changing any data.">
            <button
              onClick={refresh}
              disabled={loading}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              Refresh
            </button>
          </ActionWithInfo>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-semibold">Moderation Queue ({pending.length})</h2>
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
                    {listing.location_text ? ` - ${listing.location_text}` : ""}
                  </p>
                  <p className="text-xs text-foreground/40">
                    {listing.listing_source} listing by {listing.seller_email} -{" "}
                    {new Date(listing.created_at).toLocaleDateString()}
                  </p>
                  <Link
                    href={`/boats/${listing.slug || listing.id}`}
                    className="mt-2 inline-block text-xs text-primary hover:text-primary-light"
                  >
                    Open Listing
                  </Link>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(listing.id)}
                    disabled={actionLoading === listing.id}
                    className="rounded-full bg-green-600 px-4 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(listing.id)}
                    disabled={actionLoading === listing.id}
                    className="rounded-full bg-red-500 px-4 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50"
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
  info,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  info?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? "border-accent bg-accent/10" : "border-border"
      }`}
    >
      <p className="text-2xl font-bold">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-sm text-foreground/60">{label}</p>
        {info && <InfoBubble text={info} />}
      </div>
    </div>
  );
}

function HealthCard({
  label,
  value,
  healthy,
}: {
  label: string;
  value: string;
  healthy: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-foreground/60">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${healthy ? "text-green-600" : "text-accent"}`}>
        {value}
      </p>
    </div>
  );
}

function ActionWithInfo({
  children,
  info,
}: {
  children: ReactNode;
  info: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <InfoBubble text={info} />
    </div>
  );
}

function InfoBubble({ text }: { text: string }) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="More information"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-foreground/55 transition-colors hover:border-primary hover:text-primary"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground/75 shadow-xl group-hover:block">
        {text}
      </div>
    </div>
  );
}
