"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  ownerPulse: {
    signups24h: number;
    savedSearches24h: number;
    shortlists24h: number;
    connectRequests24h: number;
    sellerListings24h: number;
    lastSignupAt: string | null;
    lastSavedSearchAt: string | null;
    lastShortlistAt: string | null;
    lastConnectRequestAt: string | null;
    lastSellerListingAt: string | null;
  };
  importQualitySummary: {
    activeCount: number;
    visibleCount: number;
    missingModelCount: number;
    missingLocationCount: number;
    missingImageCount: number;
    thinSummaryCount: number;
    lowPriceCount: number;
  };
  sourceHealth: Array<{
    source: string;
    activeCount: number;
    visibleCount: number;
    missingModelCount: number;
    missingLocationCount: number;
    missingImageCount: number;
    thinSummaryCount: number;
    lowPriceCount: number;
  }>;
  serviceStatus: {
    billingEnabled: boolean;
    emailEnabled: boolean;
    openAIEnabled: boolean;
    storageEnabled: boolean;
    meiliDocuments: number;
    ownerAlertRecipients: string[];
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
  source_name: string;
  seller_email: string;
  created_at: string;
  image_count: number;
  video_count: number;
  condition_score: number;
  has_description: boolean;
  quality_flags: string[];
  quality_score: number;
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

function formatRelativeTime(value: string | null) {
  if (!value) return "No activity yet";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "No activity yet";

  const diffMs = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.round(diffMs / minute));
    return `${minutes}m ago`;
  }
  if (diffMs < day) {
    const hours = Math.max(1, Math.round(diffMs / hour));
    return `${hours}h ago`;
  }

  const days = Math.max(1, Math.round(diffMs / day));
  return `${days}d ago`;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [moderationSearch, setModerationSearch] = useState("");
  const [moderationSource, setModerationSource] = useState("all");
  const [moderationIssue, setModerationIssue] = useState("all");
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const moderationParams = new URLSearchParams({ status: "pending_review" });
      if (moderationSearch.trim()) moderationParams.set("q", moderationSearch.trim());
      if (moderationSource !== "all") moderationParams.set("source", moderationSource);
      if (moderationIssue !== "all") moderationParams.set("issue", moderationIssue);

      const [statsRes, pendingRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch(`/api/admin/listings?${moderationParams.toString()}`),
      ]);
      const [statsData, pendingData] = await Promise.all([
        statsRes.json(),
        pendingRes.json(),
      ]);

      setStats(statsData);
      setPending(pendingData.listings || []);
      setLastUpdatedAt(new Date().toISOString());
      hasLoadedRef.current = true;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [moderationIssue, moderationSearch, moderationSource]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh || !stats) return;

    const interval = window.setInterval(() => {
      refresh();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [autoRefresh, refresh, stats]);

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

  const sourceOptions = Array.from(new Set((stats?.sourceHealth || []).map((row) => row.source))).sort(
    (a, b) => a.localeCompare(b)
  );
  const ownerAttention = (stats?.recentActivity || []).filter((activity) =>
    ["signup_created", "seller_listing_created", "connect_requested"].includes(activity.eventType)
  );
  const recentUnverifiedSignups = (stats?.recentSignups || []).filter((signup) => !signup.emailVerified).length;

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
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground/60">
        <span>
          {lastUpdatedAt ? `Last updated ${new Date(lastUpdatedAt).toLocaleString()}` : "Waiting for first refresh"}
        </span>
        <span className={refreshing ? "text-primary" : ""}>
          {refreshing ? "Refreshing now..." : "Dashboard idle"}
        </span>
        <button
          type="button"
          onClick={() => setAutoRefresh((current) => !current)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            autoRefresh
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-foreground/70 hover:border-primary hover:text-primary"
          }`}
        >
          {autoRefresh ? "Auto-refresh: On" : "Auto-refresh: Off"}
        </button>
      </div>
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

          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium text-foreground">Owner alerts destination</p>
            <p className="mt-1 text-sm text-foreground/70">
              New signups, connect requests, and digests currently route to{" "}
              <span className="font-medium text-foreground">
                {stats.serviceStatus.ownerAlertRecipients.join(", ")}
              </span>
              .
            </p>
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Owner Pulse</h2>
                <p className="mt-1 text-sm text-foreground/60">
                  The fastest read on whether the marketplace is moving right now and what deserves attention first.
                </p>
              </div>
              <p className="text-sm text-foreground/60">
                {recentUnverifiedSignups > 0
                  ? `${recentUnverifiedSignups} recent signup${recentUnverifiedSignups === 1 ? "" : "s"} still waiting on email verification.`
                  : "Recent signups are verified or no new signups are waiting."}
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <StatCard
                label="Signups (24h)"
                value={stats.ownerPulse.signups24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastSignupAt)}`}
                highlight={stats.ownerPulse.signups24h > 0}
              />
              <StatCard
                label="Connects (24h)"
                value={stats.ownerPulse.connectRequests24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastConnectRequestAt)}`}
                highlight={stats.ownerPulse.connectRequests24h > 0}
              />
              <StatCard
                label="Saved Searches (24h)"
                value={stats.ownerPulse.savedSearches24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastSavedSearchAt)}`}
              />
              <StatCard
                label="Shortlists (24h)"
                value={stats.ownerPulse.shortlists24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastShortlistAt)}`}
              />
              <StatCard
                label="Seller Listings (24h)"
                value={stats.ownerPulse.sellerListings24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastSellerListingAt)}`}
              />
              <StatCard
                label="Needs Verification"
                value={recentUnverifiedSignups}
                detail="Recent signups without a verified email yet."
                highlight={recentUnverifiedSignups > 0}
              />
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Source Health</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Track which inventory sources are buyer-ready and where cleanup effort is still blocking visibility.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <StatCard label="Tracked Boats" value={stats.importQualitySummary.activeCount} />
              <StatCard label="Buyer Visible" value={stats.importQualitySummary.visibleCount} highlight />
              <StatCard label="Missing Location" value={stats.importQualitySummary.missingLocationCount} />
              <StatCard label="Missing Images" value={stats.importQualitySummary.missingImageCount} />
              <StatCard label="Thin Summary" value={stats.importQualitySummary.thinSummaryCount} />
              <StatCard label="Low Price Flags" value={stats.importQualitySummary.lowPriceCount} />
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-foreground/50">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 pr-4 font-medium">Active</th>
                    <th className="py-2 pr-4 font-medium">Visible</th>
                    <th className="py-2 pr-4 font-medium">Missing location</th>
                    <th className="py-2 pr-4 font-medium">Missing images</th>
                    <th className="py-2 pr-4 font-medium">Thin summary</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sourceHealth.map((source) => {
                    const visibleRate =
                      source.activeCount > 0
                        ? `${((source.visibleCount / source.activeCount) * 100).toFixed(1)}%`
                        : "0%";

                    return (
                      <tr key={source.source} className="border-b border-border/60 last:border-b-0">
                        <td className="py-3 pr-4 font-medium">{source.source}</td>
                        <td className="py-3 pr-4 text-foreground/75">
                          {source.activeCount}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-medium text-foreground">{source.visibleCount}</div>
                          <div className="text-xs text-foreground/50">{visibleRate} visible</div>
                        </td>
                        <td className="py-3 pr-4 text-foreground/75">
                          {source.missingLocationCount}
                        </td>
                        <td className="py-3 pr-4 text-foreground/75">
                          {source.missingImageCount}
                        </td>
                        <td className="py-3 pr-4 text-foreground/75">
                          {source.thinSummaryCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Owner Attention</h2>
            <p className="mt-1 text-sm text-foreground/60">
              The recent events most likely to matter to you directly: new accounts, fresh seller supply, and active connect requests.
            </p>
            {ownerAttention.length === 0 ? (
              <p className="mt-4 text-sm text-foreground/60">No owner-priority events recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {ownerAttention.slice(0, 6).map((activity) => (
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
                      <p>{formatRelativeTime(activity.createdAt)}</p>
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Moderation Queue ({pending.length})</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Filter pending listings by source or quality issue so cleanup work stays focused.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="text"
              value={moderationSearch}
              onChange={(event) => setModerationSearch(event.target.value)}
              placeholder="Search listing or seller"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground/40"
            />
            <select
              value={moderationSource}
              onChange={(event) => setModerationSource(event.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <select
              value={moderationIssue}
              onChange={(event) => setModerationIssue(event.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All issues</option>
              <option value="missing_location">Missing location</option>
              <option value="missing_image">Missing images</option>
              <option value="missing_model">Missing model</option>
              <option value="thin_summary">Thin summary</option>
              <option value="missing_description">Missing description</option>
              <option value="low_condition">Low condition</option>
            </select>
          </div>
        </div>
        {pending.length === 0 ? (
          <p className="mt-4 text-foreground/60">No pending listings match the current filters.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {pending.map((listing) => (
              <div
                key={listing.id}
                className="flex flex-col gap-4 rounded-lg border border-border p-4 lg:flex-row lg:items-start lg:justify-between"
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
                    {listing.source_name} source by {listing.seller_email} -{" "}
                    {new Date(listing.created_at).toLocaleDateString()}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-border px-2 py-1 text-foreground/70">
                      Quality {listing.quality_score}/100
                    </span>
                    <span className="rounded-full border border-border px-2 py-1 text-foreground/70">
                      {listing.image_count} photo{listing.image_count === 1 ? "" : "s"}
                    </span>
                    {listing.video_count > 0 && (
                      <span className="rounded-full border border-border px-2 py-1 text-foreground/70">
                        {listing.video_count} video{listing.video_count === 1 ? "" : "s"}
                      </span>
                    )}
                    {!listing.has_description && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">
                        Missing description
                      </span>
                    )}
                    {listing.quality_flags.map((flag) => (
                      <span
                        key={flag}
                        className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200"
                      >
                        {formatQualityFlag(flag)}
                      </span>
                    ))}
                  </div>
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
  detail,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  info?: string;
  detail?: string;
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
      {detail && <p className="mt-2 text-xs text-foreground/55">{detail}</p>}
    </div>
  );
}

function formatQualityFlag(flag: string) {
  return flag.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
