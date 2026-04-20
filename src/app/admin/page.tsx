"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { getSafeExternalUrl } from "@/lib/url-safety";
import {
  getLocationMapReadinessBlockers,
  isLocationMapDataReady,
} from "@/lib/locations/location-readiness";

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
    sellerRoleSelections: number;
    savedSearches: number;
    sellerListings: number;
    sellerListingSubmissions: number;
    listingClaims: number;
    matchInterested: number;
    connectRequests: number;
    contactGateOpens: number;
    contactGateSaves: number;
    contactGateGuestContinue: number;
    paidCheckouts: number;
    paymentRenewals: number;
    paymentFailures: number;
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
    listingSubmissions24h: number;
    claimRequests24h: number;
    paidCheckouts24h: number;
    paymentFailures24h: number;
    lastSignupAt: string | null;
    lastSavedSearchAt: string | null;
    lastShortlistAt: string | null;
    lastConnectRequestAt: string | null;
    lastSellerListingAt: string | null;
    lastListingSubmissionAt: string | null;
    lastClaimRequestAt: string | null;
    lastPaidCheckoutAt: string | null;
    lastPaymentFailureAt: string | null;
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
    contactClicks30d: number;
    missingModelCount: number;
    missingLocationCount: number;
    missingImageCount: number;
    thinSummaryCount: number;
    lowPriceCount: number;
    decisionStatus: string;
    decisionReason: string | null;
  }>;
  locationReadiness: {
    activeVisibleCount: number;
    withLocationTextCount: number;
    withMarketSlugsCount: number;
    cityOrBetterCount: number;
    exactCoordinatesCount: number;
    mappableCoordinatesCount: number;
    rawCoordinatesCount: number;
    cityCoordinatesCount: number;
    regionalCoordinatesCount: number;
    approximateCount: number;
    missingLocationCount: number;
    unclassifiedLocationCount: number;
    geocodeReadyCount: number;
    geocodePendingCount: number;
    geocodeReviewCount: number;
    geocodeFailedCount: number;
    geocodeSkippedCount: number;
    geocodedCount: number;
    countryHintMismatchCount: number;
    countryHintMismatches: Array<{
      locationText: string;
      storedCountry: string | null;
      expectedCountry: string;
      expectedRegion: string;
      matchedTerm: string;
      count: number;
    }>;
    topMarkets: Array<{
      slug: string;
      label: string;
      count: number;
    }>;
    unclassifiedLocations: Array<{
      locationText: string;
      count: number;
      sourceCount: number;
    }>;
    geocodeCandidates: Array<{
      locationText: string;
      count: number;
      confidence: string | null;
      country: string | null;
      region: string | null;
    }>;
    precisionSplit: Array<{
      precision: string;
      count: number;
    }>;
    providerSplit: Array<{
      provider: string;
      count: number;
    }>;
  };
  mediaHealth: {
    externalImageCount: number;
    checkedCount: number;
    okCount: number;
    failedCount: number;
    blockedCount: number;
    uncheckedCount: number;
    checked24hCount: number;
  };
  serviceStatus: {
    billingEnabled: boolean;
    emailEnabled: boolean;
    openAIEnabled: boolean;
    locationGeocodingEnabled: boolean;
    locationGeocodingProvider: string;
    publicMapEnabled: boolean;
    matchIntelligenceEnabled: boolean;
    matchIntelligenceProvider: string;
    semanticMatchingEnabled: boolean;
    embeddingProvider: string;
    storageEnabled: boolean;
    meiliDocuments: number;
    ownerAlertRecipients: string[];
  };
  deployStatus: {
    version: string;
    buildSha: string;
    buildShaShort: string;
    buildBranch: string;
    buildShaSource: string;
    buildBranchSource: string;
    nodeEnv: string;
    servedAt: string;
    healthPath: string;
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
  source_url?: string | null;
  seller_email: string;
  created_at: string;
  image_count: number;
  video_count: number;
  condition_score: number;
  has_description: boolean;
  quality_flags: string[];
  quality_score: number;
}

interface ClaimRequest {
  id: string;
  status: "draft_created" | "reviewing" | "approved" | "rejected";
  note: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  boat_id: string;
  boat_slug: string | null;
  boat_title: string;
  boat_source_name: string | null;
  boat_source_site: string | null;
  boat_location_text: string | null;
  claimant_user_id: string;
  claimant_email: string;
  claimant_display_name: string | null;
  claimed_listing_id: string | null;
  claimed_listing_slug: string | null;
  claimed_listing_status: string | null;
}

type ActivityFilter =
  | "all"
  | "signup_created"
  | "saved_search_created"
  | "seller_role_selected"
  | "match_interested"
  | "connect_requested"
  | "seller_listing_created"
  | "seller_listing_submitted"
  | "listing_claim_requested"
  | "contact_gate_saved"
  | "contact_gate_guest_continue"
  | "checkout_completed"
  | "invoice_payment_succeeded"
  | "invoice_payment_failed";

const ACTIVITY_FILTER_OPTIONS: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "signup_created", label: "Signups" },
  { value: "saved_search_created", label: "Saved searches" },
  { value: "seller_role_selected", label: "Seller roles" },
  { value: "match_interested", label: "Shortlists" },
  { value: "connect_requested", label: "Connects" },
  { value: "seller_listing_created", label: "Seller listings" },
  { value: "seller_listing_submitted", label: "Listing submissions" },
  { value: "listing_claim_requested", label: "Claim requests" },
  { value: "contact_gate_saved", label: "Saved before outbound" },
  { value: "contact_gate_guest_continue", label: "Guest outbound" },
  { value: "checkout_completed", label: "Paid starts" },
  { value: "invoice_payment_succeeded", label: "Paid renewals" },
  { value: "invoice_payment_failed", label: "Payment failures" },
];

function formatActivityTitle(activity: Stats["recentActivity"][number]) {
  switch (activity.eventType) {
    case "signup_created":
      return "New signup";
    case "buyer_profile_saved":
      return "Buyer profile updated";
    case "seller_role_selected":
      return "Seller access started";
    case "saved_search_created":
      return "Saved search created";
    case "seller_listing_created":
      return "Seller listing created";
    case "seller_listing_submitted":
      return "Seller listing submitted";
    case "listing_claim_requested":
      return "Imported listing claimed";
    case "match_interested":
      return "Boat added to shortlist";
    case "connect_requested":
      return "Connect request sent";
    case "contact_gate_saved":
      return "Saved before outbound click";
    case "contact_gate_guest_continue":
      return "Guest outbound click";
    case "checkout_completed":
      return "Paid checkout completed";
    case "invoice_payment_succeeded":
      return "Invoice payment succeeded";
    case "invoice_payment_failed":
      return "Invoice payment failed";
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
    case "seller_role_selected": {
      const role = typeof activity.payload.role === "string" ? activity.payload.role : "seller";
      return `${person} unlocked ${role.replace(/[-_]+/g, " ")} access.`;
    }
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
    case "seller_listing_submitted":
      return activity.boatTitle
        ? `${person} submitted ${activity.boatTitle} for review.`
        : `${person} submitted a seller listing for review.`;
    case "listing_claim_requested":
      return activity.boatTitle
        ? `${person} claimed ${activity.boatTitle} into a seller draft.`
        : `${person} claimed an imported listing into a seller draft.`;
    case "match_interested":
      return activity.boatTitle
        ? `${person} shortlisted ${activity.boatTitle}.`
        : `${person} shortlisted a boat.`;
    case "connect_requested":
      return activity.boatTitle
        ? `${person} requested a connection for ${activity.boatTitle}.`
        : `${person} requested a seller connection.`;
    case "contact_gate_saved":
      return activity.boatTitle
        ? `${person} saved ${activity.boatTitle} before leaving for the original listing.`
        : `${person} saved a boat before leaving for the original listing.`;
    case "contact_gate_guest_continue":
      return activity.boatTitle
        ? `${person} continued to the original listing for ${activity.boatTitle} without saving.`
        : `${person} continued to an original listing without saving.`;
    case "checkout_completed": {
      const tier = typeof activity.payload.tier === "string" ? activity.payload.tier : "paid";
      return `${person} started the ${tier.replace(/[-_]+/g, " ")} plan checkout successfully.`;
    }
    case "invoice_payment_succeeded": {
      const amountPaid = typeof activity.payload.amountPaid === "number" ? activity.payload.amountPaid : null;
      const currency =
        typeof activity.payload.currency === "string"
          ? activity.payload.currency.toUpperCase()
          : "USD";
      const planTier =
        typeof activity.payload.planTier === "string"
          ? activity.payload.planTier.replace(/[-_]+/g, " ")
          : "paid";
      return amountPaid !== null
        ? `${person} successfully paid ${currency} ${(amountPaid / 100).toFixed(2)} for the ${planTier} plan.`
        : `${person} had a successful invoice payment on the ${planTier} plan.`;
    }
    case "invoice_payment_failed": {
      const amountDue = typeof activity.payload.amountDue === "number" ? activity.payload.amountDue : null;
      const currency =
        typeof activity.payload.currency === "string"
          ? activity.payload.currency.toUpperCase()
          : "USD";
      const planName =
        typeof activity.payload.planName === "string"
          ? activity.payload.planName
          : "paid plan";
      return amountDue !== null
        ? `${person} has a failed payment for ${planName} worth ${currency} ${(amountDue / 100).toFixed(2)}.`
        : `${person} has a failed payment for ${planName}.`;
    }
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

function formatProviderLabel(provider: string) {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "openrouter":
      return "OpenRouter";
    case "ollama":
      return "Ollama";
    case "nominatim":
      return "Nominatim";
    case "opencage":
      return "OpenCage";
    default:
      return provider === "disabled" ? "None" : provider;
  }
}

function percentOf(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function formatPercent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [cleanupQueue, setCleanupQueue] = useState<PendingListing[]>([]);
  const [claimQueue, setClaimQueue] = useState<ClaimRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [moderationSearch, setModerationSearch] = useState("");
  const [moderationSource, setModerationSource] = useState("all");
  const [moderationIssue, setModerationIssue] = useState("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
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
      const cleanupParams = new URLSearchParams({
        status: "active",
        issue: moderationIssue === "all" ? "cleanup_needed" : moderationIssue,
        sort: "quality",
        limit: "12",
      });
      if (moderationSearch.trim()) moderationParams.set("q", moderationSearch.trim());
      if (moderationSource !== "all") moderationParams.set("source", moderationSource);
      if (moderationIssue !== "all") moderationParams.set("issue", moderationIssue);
      if (moderationSearch.trim()) cleanupParams.set("q", moderationSearch.trim());
      if (moderationSource !== "all") cleanupParams.set("source", moderationSource);

      const [statsRes, pendingRes, cleanupRes, claimsRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch(`/api/admin/listings?${moderationParams.toString()}`),
        fetch(`/api/admin/listings?${cleanupParams.toString()}`),
        fetch("/api/admin/claims?limit=10"),
      ]);
      const [statsData, pendingData, cleanupData, claimsData] = await Promise.all([
        statsRes.json(),
        pendingRes.json(),
        cleanupRes.json(),
        claimsRes.json(),
      ]);

      setStats(statsData);
      setPending(pendingData.listings || []);
      setCleanupQueue(cleanupData.listings || []);
      setClaimQueue(claimsData.claims || []);
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

  async function handleExpire(id: string) {
    setActionLoading(`expire-${id}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "expired" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to expire listing");
      }

      setCleanupQueue((prev) => prev.filter((listing) => listing.id !== id));
      setStats((prev) =>
        prev
          ? {
              ...prev,
              activeListings: Math.max(0, prev.activeListings - 1),
              importQualitySummary: {
                ...prev.importQualitySummary,
                activeCount: Math.max(0, prev.importQualitySummary.activeCount - 1),
              },
            }
          : prev
      );
      setMessage("Listing expired from the active inventory.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to expire listing");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleClaimStatusUpdate(id: string, status: ClaimRequest["status"]) {
    setActionLoading(`claim-${id}-${status}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update claim request");
      }

      setClaimQueue((prev) =>
        prev.map((claim) =>
          claim.id === id
            ? {
                ...claim,
                status,
                reviewed_at: new Date().toISOString(),
              }
            : claim
        )
      );
      setMessage(`Claim request marked ${status.replace(/_/g, " ")}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update claim request");
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
  const cleanupNeededCount = stats
    ? Math.max(0, stats.importQualitySummary.activeCount - stats.importQualitySummary.visibleCount)
    : 0;
  const recentActivity = (stats?.recentActivity || []).filter((activity) =>
    activityFilter === "all" ? true : activity.eventType === activityFilter
  );
  const ownerAttention = recentActivity.filter((activity) =>
    [
      "signup_created",
      "seller_role_selected",
      "seller_listing_created",
      "seller_listing_submitted",
      "listing_claim_requested",
      "connect_requested",
      "checkout_completed",
      "invoice_payment_failed",
    ].includes(activity.eventType)
  );
  const recentConnections = (stats?.recentActivity || []).filter(
    (activity) => activity.eventType === "connect_requested"
  );
  const recentUnverifiedSignups = (stats?.recentSignups || []).filter((signup) => !signup.emailVerified).length;
  const locationReadiness = stats?.locationReadiness;
  const locationReadinessTotal = locationReadiness?.activeVisibleCount || 0;
  const marketTagRate = percentOf(locationReadiness?.withMarketSlugsCount || 0, locationReadinessTotal);
  const cityOrBetterRate = percentOf(locationReadiness?.cityOrBetterCount || 0, locationReadinessTotal);
  const mappableCoordinateRate = percentOf(locationReadiness?.mappableCoordinatesCount || 0, locationReadinessTotal);
  const heldBackCoordinateCount =
    (locationReadiness?.rawCoordinatesCount || 0) - (locationReadiness?.mappableCoordinatesCount || 0);
  const locationReviewBlockerCount =
    (locationReadiness?.geocodeReviewCount || 0) +
    (locationReadiness?.geocodeFailedCount || 0);
  const locationMapReadinessInput = {
    marketTagRate,
    cityOrBetterRate,
    mappableCoordinateRate,
    countryHintMismatchCount: locationReadiness?.countryHintMismatchCount || 0,
    reviewFailedCount: locationReviewBlockerCount,
    geocodingEnabled: stats?.serviceStatus.locationGeocodingEnabled === true,
  };
  const locationMapBlockers = getLocationMapReadinessBlockers(locationMapReadinessInput);
  const mapReady = isLocationMapDataReady(locationMapReadinessInput);
  const mediaHealth = stats?.mediaHealth;

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

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-8">
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
              label="Match AI"
              value={
                stats.serviceStatus.matchIntelligenceEnabled
                  ? formatProviderLabel(stats.serviceStatus.matchIntelligenceProvider)
                  : "Fallback Only"
              }
              healthy={stats.serviceStatus.matchIntelligenceEnabled}
            />
            <HealthCard
              label="Embeddings"
              value={
                stats.serviceStatus.semanticMatchingEnabled
                  ? formatProviderLabel(stats.serviceStatus.embeddingProvider)
                  : "Off"
              }
              healthy={stats.serviceStatus.semanticMatchingEnabled}
            />
            <HealthCard
              label="Storage"
              value={stats.serviceStatus.storageEnabled ? "Configured" : "Missing"}
              healthy={stats.serviceStatus.storageEnabled}
            />
            <HealthCard
              label="Geocoder"
              value={
                stats.serviceStatus.locationGeocodingEnabled
                  ? formatProviderLabel(stats.serviceStatus.locationGeocodingProvider)
                  : "Off"
              }
              healthy={stats.serviceStatus.locationGeocodingEnabled}
            />
            <HealthCard
              label="Public Map"
              value={stats.serviceStatus.publicMapEnabled ? "Enabled" : "Gated"}
              healthy={stats.serviceStatus.publicMapEnabled}
            />
            <HealthCard
              label="Search Docs"
              value={`${stats.serviceStatus.meiliDocuments}`}
              healthy={stats.serviceStatus.meiliDocuments >= stats.activeListings}
            />
          </div>

          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Deploy status</p>
                <p className="mt-1 text-sm text-foreground/70">
                  Admin is currently serving build <span className="font-medium text-foreground">{stats.deployStatus.buildShaShort}</span>
                  {" "}from <span className="font-medium text-foreground">{stats.deployStatus.buildBranch}</span>.
                </p>
              </div>
              <Link
                href={stats.deployStatus.healthPath}
                className="text-sm font-medium text-primary transition-colors hover:text-primary-light"
              >
                Open deploy diagnostics
              </Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <HealthCard
                label="Build SHA"
                value={stats.deployStatus.buildShaShort}
                healthy={stats.deployStatus.buildSha !== "unknown"}
              />
              <HealthCard
                label="Branch"
                value={stats.deployStatus.buildBranch}
                healthy={stats.deployStatus.buildBranch !== "unknown"}
              />
              <HealthCard
                label="Version"
                value={stats.deployStatus.version}
                healthy={true}
              />
              <HealthCard
                label="Runtime"
                value={stats.deployStatus.nodeEnv}
                healthy={stats.deployStatus.nodeEnv === "production"}
              />
            </div>
            <p className="mt-3 text-sm text-foreground/60">
              Stats snapshot served {new Date(stats.deployStatus.servedAt).toLocaleString()}.
              Build sources: SHA from {stats.deployStatus.buildShaSource}, branch from {stats.deployStatus.buildBranchSource}.
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium text-foreground">Owner alerts destination</p>
            <p className="mt-1 text-sm text-foreground/70">
              New signups, billing alerts, connect requests, and digests currently route to{" "}
              <span className="font-medium text-foreground">
                {stats.serviceStatus.ownerAlertRecipients.join(", ")}
              </span>
              .
            </p>
            <p className="mt-2 text-sm text-foreground/70">
              Matching stack:{" "}
              <span className="font-medium text-foreground">
                {stats.serviceStatus.matchIntelligenceEnabled
                  ? formatProviderLabel(stats.serviceStatus.matchIntelligenceProvider)
                  : "fallback rules only"}
              </span>
              {" "}with{" "}
              <span className="font-medium text-foreground">
                {stats.serviceStatus.semanticMatchingEnabled
                  ? `${formatProviderLabel(stats.serviceStatus.embeddingProvider)} embeddings`
                  : "no semantic embeddings"}
              </span>
              .
            </p>
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div id="owner-pulse" />
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
                actionHref="#recent-signups"
                actionLabel="Open signups"
              />
              <StatCard
                label="Connects (24h)"
                value={stats.ownerPulse.connectRequests24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastConnectRequestAt)}`}
                highlight={stats.ownerPulse.connectRequests24h > 0}
                actionHref="#recent-connections"
                actionLabel="Open connects"
              />
              <StatCard
                label="Saved Searches (24h)"
                value={stats.ownerPulse.savedSearches24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastSavedSearchAt)}`}
                actionHref="#recent-activity"
                actionLabel="Open activity"
              />
              <StatCard
                label="Shortlists (24h)"
                value={stats.ownerPulse.shortlists24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastShortlistAt)}`}
                actionHref="#recent-activity"
                actionLabel="Open activity"
              />
              <StatCard
                label="Seller Listings (24h)"
                value={stats.ownerPulse.sellerListings24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastSellerListingAt)}`}
                actionHref="#owner-attention"
                actionLabel="Open supply"
              />
              <StatCard
                label="Listing Submissions (24h)"
                value={stats.ownerPulse.listingSubmissions24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastListingSubmissionAt)}`}
                highlight={stats.ownerPulse.listingSubmissions24h > 0}
                actionHref="#claim-queue"
                actionLabel="Open claim and review work"
              />
              <StatCard
                label="Claim Requests (24h)"
                value={stats.ownerPulse.claimRequests24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastClaimRequestAt)}`}
                highlight={stats.ownerPulse.claimRequests24h > 0}
                actionHref="#claim-queue"
                actionLabel="Open claim queue"
              />
              <StatCard
                label="Paid Starts (24h)"
                value={stats.ownerPulse.paidCheckouts24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastPaidCheckoutAt)}`}
                highlight={stats.ownerPulse.paidCheckouts24h > 0}
                actionHref="#owner-attention"
                actionLabel="Open billing events"
              />
              <StatCard
                label="Payment Failures (24h)"
                value={stats.ownerPulse.paymentFailures24h}
                detail={`Last: ${formatRelativeTime(stats.ownerPulse.lastPaymentFailureAt)}`}
                highlight={stats.ownerPulse.paymentFailures24h > 0}
                actionHref="#owner-attention"
                actionLabel="Review failures"
              />
              <StatCard
                label="Needs Verification"
                value={recentUnverifiedSignups}
                detail="Recent signups without a verified email yet."
                highlight={recentUnverifiedSignups > 0}
                actionHref="#recent-signups"
                actionLabel="Review signups"
              />
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Source Health</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Track which imported sources are buyer-ready, where engagement is actually showing up, and where cleanup work is still blocking visibility.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <StatCard label="Imported Boats" value={stats.importQualitySummary.activeCount} />
              <StatCard label="Buyer Visible" value={stats.importQualitySummary.visibleCount} highlight />
              <StatCard
                label="Needs Cleanup"
                value={cleanupNeededCount}
                actionHref="#cleanup-queue"
                actionLabel="Open cleanup queue"
              />
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
                    <th className="py-2 pr-4 font-medium">Clicks (30d)</th>
                    <th className="py-2 pr-4 font-medium">Policy</th>
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
                          {source.contactClicks30d}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-medium capitalize text-foreground">
                            {source.decisionStatus}
                          </div>
                          {source.decisionReason && (
                            <div className="max-w-xs text-xs text-foreground/50">
                              {source.decisionReason}
                            </div>
                          )}
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">External Media Health</h2>
                <p className="mt-1 text-sm text-foreground/60">
                  Imported image fetch checks for catching broken source-hosted media before it hits buyer pages.
                </p>
              </div>
              <span
                className={`inline-flex self-start rounded-full border px-3 py-1 text-xs font-semibold ${
                  (mediaHealth?.failedCount || 0) + (mediaHealth?.blockedCount || 0) > 0
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                    : "border-green-500/40 bg-green-500/10 text-green-600"
                }`}
              >
                {(mediaHealth?.checkedCount || 0) > 0 ? "Audit started" : "Audit not started"}
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="External Images"
                value={mediaHealth?.externalImageCount || 0}
                detail="Source-hosted image URLs on public visible imported boats."
              />
              <StatCard
                label="Checked"
                value={mediaHealth?.checkedCount || 0}
                detail={`${(mediaHealth?.checked24hCount || 0).toLocaleString()} checked in the last 24 hours.`}
              />
              <StatCard
                label="Healthy"
                value={mediaHealth?.okCount || 0}
                detail="Returned image MIME type with non-empty bytes."
              />
              <StatCard
                label="Needs Media Fix"
                value={(mediaHealth?.failedCount || 0) + (mediaHealth?.blockedCount || 0)}
                detail={`${(mediaHealth?.failedCount || 0).toLocaleString()} failed, ${(mediaHealth?.blockedCount || 0).toLocaleString()} blocked.`}
                highlight={((mediaHealth?.failedCount || 0) + (mediaHealth?.blockedCount || 0)) > 0}
              />
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Location Readiness</h2>
                <p className="mt-1 text-sm text-foreground/60">
                  Map gate: {mapReady ? "data ready for product design" : locationMapBlockers.join(", ")}.
                  Geocoder:{" "}
                  {stats.serviceStatus.locationGeocodingEnabled
                    ? formatProviderLabel(stats.serviceStatus.locationGeocodingProvider)
                    : "configure provider before applying coordinates"}.
                  Public map: {stats.serviceStatus.publicMapEnabled ? "enabled" : "gated"}.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/map-readiness"
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground/70 hover:border-primary hover:text-primary"
                >
                  Open map readiness
                </Link>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                    mapReady
                      ? "border-green-500/40 bg-green-500/10 text-green-600"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-600"
                  }`}
                >
                  {mapReady ? "Map data ready" : "Map data not ready"}
                </span>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ProgressCard
                label="Market tagged"
                value={locationReadiness?.withMarketSlugsCount || 0}
                total={locationReadinessTotal}
                targetPercent={95}
              />
              <ProgressCard
                label="City or better"
                value={locationReadiness?.cityOrBetterCount || 0}
                total={locationReadinessTotal}
                targetPercent={85}
              />
              <ProgressCard
                label="Public map pins"
                value={locationReadiness?.mappableCoordinatesCount || 0}
                total={locationReadinessTotal}
                targetPercent={85}
              />
              <ProgressCard
                label="Non-approx pins"
                value={locationReadiness?.exactCoordinatesCount || 0}
                total={locationReadinessTotal}
                targetPercent={50}
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Buyer Visible Boats"
                value={locationReadinessTotal}
                info="Active public listings after import-quality suppression."
              />
              <StatCard
                label="Geocode Ready"
                value={locationReadiness?.geocodeReadyCount || 0}
                detail="Specific, market-tagged listings without coordinates."
                highlight={(locationReadiness?.geocodeReadyCount || 0) > 0}
              />
              <StatCard
                label="Country Hint Mismatch"
                value={locationReadiness?.countryHintMismatchCount || 0}
                detail="Explicit location text conflicts with stored country."
                highlight={(locationReadiness?.countryHintMismatchCount || 0) > 0}
              />
              <StatCard
                label="Held Back From Map"
                value={heldBackCoordinateCount}
                detail={`${(locationReadiness?.cityCoordinatesCount || 0).toLocaleString()} city, ${(locationReadiness?.regionalCoordinatesCount || 0).toLocaleString()} regional or weaker.`}
                highlight={heldBackCoordinateCount > 0}
              />
              <StatCard
                label="Needs Review"
                value={locationReviewBlockerCount}
                detail={`${(locationReadiness?.geocodeReviewCount || 0).toLocaleString()} review, ${(locationReadiness?.geocodeFailedCount || 0).toLocaleString()} failed.`}
                highlight={locationReviewBlockerCount > 0}
              />
              <StatCard
                label="Approximate Only"
                value={locationReadiness?.approximateCount || 0}
                detail="Useful for regional search, not enough for precise map pins."
                highlight={(locationReadiness?.approximateCount || 0) > 0}
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Unclassified Text"
                value={locationReadiness?.unclassifiedLocationCount || 0}
                detail="Location text exists, but no curated market slug matched."
                highlight={(locationReadiness?.unclassifiedLocationCount || 0) > 0}
              />
              <StatCard
                label="Missing Location"
                value={locationReadiness?.missingLocationCount || 0}
                detail="These listings cannot support regional search or maps."
                highlight={(locationReadiness?.missingLocationCount || 0) > 0}
              />
              <StatCard
                label="Geocoded"
                value={locationReadiness?.geocodedCount || 0}
                detail={`${(locationReadiness?.geocodeSkippedCount || 0).toLocaleString()} skipped after review.`}
              />
              <StatCard
                label="Pending Queue"
                value={locationReadiness?.geocodePendingCount || 0}
                detail="Listings waiting for the geocoding workflow."
              />
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Top Tagged Markets</h3>
                <div className="mt-3 space-y-3">
                  {(locationReadiness?.topMarkets || []).length === 0 ? (
                    <p className="text-sm text-foreground/60">No market tags yet.</p>
                  ) : (
                    locationReadiness!.topMarkets.map((market) => (
                      <MetricRow
                        key={market.slug}
                        label={market.label}
                        value={market.count}
                        percent={percentOf(market.count, locationReadinessTotal)}
                      />
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Coordinate Quality</h3>
                <div className="mt-3 space-y-3">
                  {(locationReadiness?.precisionSplit || []).length === 0 ? (
                    <p className="text-sm text-foreground/60">No visible listings have coordinates yet.</p>
                  ) : (
                    locationReadiness!.precisionSplit.map((row) => (
                      <MetricRow
                        key={row.precision}
                        label={row.precision.replace(/_/g, " ")}
                        value={row.count}
                        percent={percentOf(row.count, locationReadiness?.rawCoordinatesCount || 0)}
                      />
                    ))
                  )}
                </div>
                <div className="mt-4 border-t border-border/60 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Providers</p>
                  <div className="mt-2 space-y-2">
                    {(locationReadiness?.providerSplit || []).length === 0 ? (
                      <p className="text-sm text-foreground/60">No provider history yet.</p>
                    ) : (
                      locationReadiness!.providerSplit.map((row) => (
                        <MetricRow
                          key={row.provider}
                          label={formatProviderLabel(row.provider)}
                          value={row.count}
                          percent={percentOf(row.count, locationReadiness?.rawCoordinatesCount || 0)}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Unclassified Location Text</h3>
                <div className="mt-3 space-y-3">
                  {(locationReadiness?.unclassifiedLocations || []).length === 0 ? (
                    <p className="text-sm text-foreground/60">All visible location text maps to curated markets.</p>
                  ) : (
                    locationReadiness!.unclassifiedLocations.map((row) => (
                      <div
                        key={`${row.locationText}-${row.count}`}
                        className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-b-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{row.locationText}</p>
                          <p className="text-xs text-foreground/50">
                            {row.sourceCount} source{row.sourceCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-foreground">{row.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Country Hint Mismatches</h3>
                <div className="mt-3 space-y-3">
                  {(locationReadiness?.countryHintMismatches || []).length === 0 ? (
                    <p className="text-sm text-foreground/60">Stored countries match explicit location hints.</p>
                  ) : (
                    locationReadiness!.countryHintMismatches.map((row) => (
                      <div
                        key={`${row.locationText}-${row.expectedCountry}`}
                        className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-b-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{row.locationText}</p>
                          <p className="mt-1 text-xs text-foreground/50">
                            {row.storedCountry || "Missing country"} to {row.expectedCountry}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-foreground">{row.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Geocode Queue</h3>
                <div className="mt-3 space-y-3">
                  {(locationReadiness?.geocodeCandidates || []).length === 0 ? (
                    <p className="text-sm text-foreground/60">No coordinate-ready locations waiting.</p>
                  ) : (
                    locationReadiness!.geocodeCandidates.map((row) => (
                      <div
                        key={`${row.locationText}-${row.count}`}
                        className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-b-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{row.locationText}</p>
                          <p className="text-xs text-foreground/50">
                            {[row.confidence, row.country || row.region].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-foreground">{row.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Funnel - Last 30 Days</h2>
            <p className="mt-1 text-sm text-foreground/60">
              This is the actual product flow, including paid conversion and billing friction, not just raw account or listing totals.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
              <StatCard label="Signups" value={stats.funnel30d.signups} />
              <StatCard label="Buyer Profiles" value={stats.funnel30d.buyerProfiles} />
              <StatCard label="Seller Roles" value={stats.funnel30d.sellerRoleSelections} />
              <StatCard label="Saved Searches" value={stats.funnel30d.savedSearches} />
              <StatCard label="Seller Listings" value={stats.funnel30d.sellerListings} />
              <StatCard label="Listing Submissions" value={stats.funnel30d.sellerListingSubmissions} />
              <StatCard label="Claim Drafts" value={stats.funnel30d.listingClaims} />
              <StatCard label="Shortlist Saves" value={stats.funnel30d.matchInterested} />
              <StatCard label="Gate Saves" value={stats.funnel30d.contactGateSaves} />
              <StatCard label="Connect Requests" value={stats.funnel30d.connectRequests} highlight />
              <StatCard label="Guest Outbound" value={stats.funnel30d.contactGateGuestContinue} />
              <StatCard label="Paid Starts" value={stats.funnel30d.paidCheckouts} />
              <StatCard
                label="Payment Failures"
                value={stats.funnel30d.paymentFailures}
                highlight={stats.funnel30d.paymentFailures > 0}
              />
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <div id="recent-signups" />
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
            <div id="recent-activity" />
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Live product activity across signups, saved searches, shortlists, connects, and billing events.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {ACTIVITY_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActivityFilter(option.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    activityFilter === option.value
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-foreground/70 hover:border-primary hover:text-primary"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {recentActivity.length === 0 ? (
              <p className="mt-4 text-sm text-foreground/60">No recent activity recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {recentActivity.map((activity) => (
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
            <div id="owner-attention" />
            <h2 className="text-lg font-semibold">Owner Attention</h2>
            <p className="mt-1 text-sm text-foreground/60">
              The recent events most likely to matter to you directly: new accounts, paid starts, payment failures, fresh seller supply, and active connect requests.
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

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <div id="recent-connections" />
            <h2 className="text-lg font-semibold">Recent Connections</h2>
            <p className="mt-1 text-sm text-foreground/60">
              The newest buyer-to-seller connection requests, separated out so real demand is easy to spot.
            </p>
            {recentConnections.length === 0 ? (
              <p className="mt-4 text-sm text-foreground/60">No connection requests recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {recentConnections.slice(0, 6).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex flex-col justify-between gap-2 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-medium">{activity.boatTitle || "Boat connection request"}</p>
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

      <div className="mt-12">
        <div id="claim-queue" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Claim Queue ({claimQueue.length})</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Imported listings that have been pulled into seller-owned drafts. This is the bridge from scraped inventory into native supply.
            </p>
          </div>
          <div className="text-sm text-foreground/60">
            Review the request, open the draft, and keep the seller moving.
          </div>
        </div>
        {claimQueue.length === 0 ? (
          <p className="mt-4 text-foreground/60">No claim requests yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {claimQueue.map((claim) => (
              <div
                key={claim.id}
                className="flex flex-col gap-4 rounded-lg border border-border p-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div>
                  <p className="font-medium">{claim.boat_title}</p>
                  <p className="text-sm text-foreground/60">
                    {claim.boat_location_text || "Location pending"} · {claim.boat_source_name || claim.boat_source_site || "Imported source"}
                  </p>
                  <p className="text-xs text-foreground/40">
                    Claimed by {claim.claimant_display_name?.trim() || "Unnamed user"} ({claim.claimant_email}) · {new Date(claim.created_at).toLocaleString()}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
                      {claim.status.replace(/_/g, " ")}
                    </span>
                    {claim.claimed_listing_status && (
                      <span className="rounded-full border border-border px-2 py-1 text-foreground/70">
                        Draft status: {claim.claimed_listing_status.replace(/_/g, " ")}
                      </span>
                    )}
                    {claim.reviewed_at && (
                      <span className="rounded-full border border-border px-2 py-1 text-foreground/70">
                        Reviewed {formatRelativeTime(claim.reviewed_at)}
                      </span>
                    )}
                  </div>
                  {claim.note && (
                    <p className="mt-3 text-sm text-foreground/60">{claim.note}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/boats/${claim.boat_slug || claim.boat_id}`}
                    className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground hover:border-primary hover:text-primary"
                  >
                    Open source
                  </Link>
                  {claim.claimed_listing_id && (
                    <Link
                      href={`/listings/${claim.claimed_listing_id}`}
                      className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground hover:border-primary hover:text-primary"
                    >
                      Open draft
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleClaimStatusUpdate(claim.id, "reviewing")}
                    disabled={actionLoading === `claim-${claim.id}-reviewing`}
                    className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    Reviewing
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleClaimStatusUpdate(claim.id, "approved")}
                    disabled={actionLoading === `claim-${claim.id}-approved`}
                    className="rounded-full bg-primary-btn px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleClaimStatusUpdate(claim.id, "rejected")}
                    disabled={actionLoading === `claim-${claim.id}-rejected`}
                    className="rounded-full border border-red-500/30 px-4 py-1.5 text-sm text-red-300 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
            <ActionWithInfo info="Runs the imported-listing cleanup pass on the live server for the top active imported rows. Use this when source data needs normalization or trust cleanup.">
              <button
                onClick={() =>
                  runMaintenanceAction(
                    "clean-imports",
                    "/api/admin/maintenance/clean-imports",
                    { limit: 500 },
                    (data) =>
                      `Cleaned ${data.processed || 0} imported rows. ${data.hiddenInBatch || 0} hidden, ${data.visibleInBatch || 0} visible in batch.`
                  )
                }
                disabled={actionLoading === "clean-imports"}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
              >
                {actionLoading === "clean-imports" ? "Cleaning..." : "Clean Imported Data"}
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
        <div id="cleanup-queue" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Active Cleanup Queue ({cleanupQueue.length})</h2>
            <p className="mt-1 text-sm text-foreground/60">
              The active imported listings most likely to hurt buyer trust right now, ranked by weakest quality first.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-foreground/60">
              Uses the same source and issue filters as the moderation queue.
            </span>
            <button
              type="button"
              onClick={() =>
                runMaintenanceAction(
                  "expire-cleanup-queue",
                  "/api/admin/listings/bulk",
                  { status: "expired", ids: cleanupQueue.map((listing) => listing.id) },
                  (data) => `Expired ${data.updated || 0} cleanup rows from active inventory.`,
                  cleanupQueue.length > 0
                    ? `Expire all ${cleanupQueue.length} listings currently shown in the cleanup queue?`
                    : undefined
                )
              }
              disabled={cleanupQueue.length === 0 || actionLoading === "expire-cleanup-queue"}
              className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition-all hover:bg-red-500/15 disabled:opacity-50"
            >
              {actionLoading === "expire-cleanup-queue" ? "Expiring..." : "Expire Shown"}
            </button>
          </div>
        </div>
        {cleanupQueue.length === 0 ? (
          <p className="mt-4 text-foreground/60">No active listings currently need cleanup for these filters.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {cleanupQueue.map((listing) => (
              <div
                key={`cleanup-${listing.id}`}
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
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">
                      Cleanup score {listing.quality_score}/100
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
                    {listing.condition_score < 6 && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">
                        Low condition
                      </span>
                    )}
                    {listing.quality_flags.map((flag) => (
                      <span
                        key={`cleanup-${listing.id}-${flag}`}
                        className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200"
                      >
                        {formatQualityFlag(flag)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {getSafeExternalUrl(listing.source_url) && (
                    <a
                      href={getSafeExternalUrl(listing.source_url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground hover:border-primary hover:text-primary"
                    >
                      Open Source
                    </a>
                  )}
                  <Link
                    href={`/boats/${listing.slug || listing.id}`}
                    className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground hover:border-primary hover:text-primary"
                  >
                    Open Listing
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleExpire(listing.id)}
                    disabled={actionLoading === `expire-${listing.id}`}
                    className="rounded-full bg-red-500 px-4 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    {actionLoading === `expire-${listing.id}` ? "Expiring..." : "Expire"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
              <option value="low_price">Low price</option>
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
  actionHref,
  actionLabel,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  info?: string;
  detail?: string;
  actionHref?: string;
  actionLabel?: string;
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
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-3 inline-flex text-xs font-medium text-primary transition-colors hover:text-primary-light"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function formatQualityFlag(flag: string) {
  return flag.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function ProgressCard({
  label,
  value,
  total,
  targetPercent,
}: {
  label: string;
  value: number;
  total: number;
  targetPercent: number;
}) {
  const percent = percentOf(value, total);
  const passesTarget = percent >= targetPercent;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-foreground/60">{label}</p>
          <p className="mt-1 text-2xl font-bold">{formatPercent(percent)}</p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
            passesTarget
              ? "border-green-500/40 bg-green-500/10 text-green-600"
              : "border-amber-500/40 bg-amber-500/10 text-amber-600"
          }`}
        >
          {targetPercent}% target
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${
            passesTarget ? "bg-green-500" : "bg-amber-500"
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-foreground/55">
        {value.toLocaleString()} of {total.toLocaleString()} active public listings
      </p>
    </div>
  );
}

function MetricRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: number;
  percent: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-foreground">{label}</span>
        <span className="shrink-0 text-foreground/70">
          {value.toLocaleString()} · {formatPercent(percent)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
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
