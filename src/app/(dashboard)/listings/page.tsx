import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { emailEnabled } from "@/lib/capabilities";
import {
  getSellerDashboardData,
  respondToSellerIntroduction,
  type SellerLead,
  type SellerListing,
} from "@/lib/seller/dashboard";

export default async function ListingsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?callbackUrl=%2Flistings");
  }

  const { created } = await searchParams;
  const canSell = ["seller", "both", "admin"].includes(user.role);

  if (!canSell) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold">Seller Dashboard</h1>
        <p className="mt-3 text-text-secondary">
          Your account is currently set up for buying. Enable seller access to publish
          and manage boat listings.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/onboarding?role=seller"
            className="rounded-full bg-primary-btn px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-light"
          >
            Become a Seller
          </Link>
          <Link
            href="/boats"
            className="rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
          >
            Browse Boats
          </Link>
        </div>
      </div>
    );
  }

  const [{ stats, listings, leads }, canEmail] = await Promise.all([
    getSellerDashboardData(user.id),
    emailEnabled(),
  ]);

  async function updateLeadStatus(formData: FormData) {
    "use server";

    const currentUser = await getCurrentUser();
    if (!currentUser || !["seller", "both", "admin"].includes(currentUser.role)) {
      redirect("/sign-in?callbackUrl=%2Flistings");
    }

    const introductionId = String(formData.get("introductionId") || "");
    const action = String(formData.get("action") || "");

    if (!introductionId || (action !== "accept" && action !== "decline")) {
      return;
    }

    await respondToSellerIntroduction(currentUser.id, introductionId, action);
    revalidatePath("/listings");
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Seller Dashboard</h1>
          <p className="mt-2 text-text-secondary">
            Manage your listings, track buyer interest, and keep your boats live.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/listings/new"
            className="rounded-full bg-primary-btn px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-light"
          >
            List a Boat
          </Link>
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
            >
              Open Admin
            </Link>
          )}
        </div>
      </div>

      {created && (
        <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm text-foreground/85">
          Your listing was submitted successfully. It is now in review and will appear to
          buyers once an admin approves it.
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Listings" value={stats.totalListings} />
        <MetricCard label="Active" value={stats.activeListings} />
        <MetricCard label="In Review" value={stats.pendingListings} highlight />
        <MetricCard label="Views" value={stats.totalViews} />
        <MetricCard label="Buyer Leads" value={stats.totalLeads} />
        <MetricCard label="Pending Leads" value={stats.pendingLeads} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Lead Handling</h2>
        <p className="mt-2 text-sm text-text-secondary">
          {canEmail
            ? "Lead requests can be handled here or from the seller email notifications."
            : "Transactional email is not configured here, so buyer interest is captured and managed directly inside this dashboard."}
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          Accepted leads: {stats.acceptedLeads}. Reply directly to interested buyers using
          the email address shown below.
        </p>
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">Your Listings</h2>
          <p className="text-sm text-text-secondary">{listings.length} total</p>
        </div>

        {listings.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-lg font-medium">No listings yet.</p>
            <p className="mt-2 text-sm text-text-secondary">
              Publish your first boat to start capturing buyer leads.
            </p>
            <Link
              href="/listings/new"
              className="mt-6 inline-flex rounded-full bg-primary-btn px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-light"
            >
              Create Listing
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">Recent Buyer Leads</h2>
          <p className="text-sm text-text-secondary">{leads.length} recent</p>
        </div>

        {leads.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-lg font-medium">No buyer leads yet.</p>
            <p className="mt-2 text-sm text-text-secondary">
              When buyers request contact on your boats, they will show up here.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} updateLeadStatus={updateLeadStatus} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
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
      className={`rounded-2xl border p-4 ${
        highlight ? "border-accent/40 bg-accent/10" : "border-border bg-surface"
      }`}
    >
      <p className="text-2xl font-bold">{value.toLocaleString("en-US")}</p>
      <p className="mt-1 text-sm text-text-secondary">{label}</p>
    </div>
  );
}

function ListingCard({ listing }: { listing: SellerListing }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold">
            {listing.year} {listing.make} {listing.model}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {formatMoney(listing.asking_price, listing.currency)}
            {listing.location_text ? ` in ${listing.location_text}` : ""}
          </p>
        </div>
        <StatusPill status={listing.status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <ListingStat label="Views" value={listing.view_count} />
        <ListingStat label="Leads" value={listing.lead_count} />
        <ListingStat label="Accepted" value={listing.accepted_lead_count} />
      </div>

      <p className="mt-4 text-sm text-text-secondary">
        Created {formatDate(listing.created_at)}
      </p>
      {listing.status === "pending_review" && (
        <p className="mt-2 text-sm text-accent">
          Buyers cannot see this listing until an admin approves it.
        </p>
      )}
      {listing.status === "rejected" && (
        <p className="mt-2 text-sm text-red-400">
          This listing is not live. Update it and resubmit through admin review.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={getBoatHref(listing)}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
        >
          Preview Listing
        </Link>
        <Link
          href="/listings/new"
          className="rounded-full px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:text-foreground"
        >
          Add Another Listing
        </Link>
      </div>
    </div>
  );
}

function ListingStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-background px-3 py-2">
      <p className="text-lg font-semibold">{value.toLocaleString("en-US")}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}

function LeadCard({
  lead,
  updateLeadStatus,
}: {
  lead: SellerLead;
  updateLeadStatus: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg font-semibold">{lead.boat_title}</p>
            <StatusPill status={lead.status} />
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            Buyer: {lead.buyer_name || "Interested buyer"}{" "}
            <a href={`mailto:${lead.buyer_email}`} className="text-primary underline">
              {lead.buyer_email}
            </a>
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Match score: {Math.round(lead.match_score * 100)}% - Requested {formatDateTime(lead.sent_at)}
          </p>
          {lead.buyer_message && (
            <div className="mt-4 rounded-xl bg-background px-4 py-3 text-sm text-foreground/85">
              {lead.buyer_message}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={lead.boat_slug ? `/boats/${lead.boat_slug}` : `/boats/${lead.boat_id}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
            >
              Open Listing
            </Link>
            <a
              href={`mailto:${lead.buyer_email}`}
              className="rounded-full bg-primary-btn px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light"
            >
              Email Buyer
            </a>
          </div>
        </div>

        {lead.status === "pending" ? (
          <form action={updateLeadStatus} className="flex flex-wrap gap-2">
            <input type="hidden" name="introductionId" value={lead.id} />
            <button
              type="submit"
              name="action"
              value="accept"
              className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-green-700"
            >
              Accept Lead
            </button>
            <button
              type="submit"
              name="action"
              value="decline"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-red-400 hover:text-red-300"
            >
              Decline
            </button>
          </form>
        ) : (
          <div className="text-sm text-text-secondary">
            {lead.status === "accepted"
              ? `Accepted${lead.responded_at ? ` ${formatDateTime(lead.responded_at)}` : ""}.`
              : `Declined${lead.responded_at ? ` ${formatDateTime(lead.responded_at)}` : ""}.`}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "border-green-500/30 bg-green-500/10 text-green-300",
    pending_review: "border-accent/30 bg-accent/10 text-accent",
    rejected: "border-red-500/30 bg-red-500/10 text-red-300",
    draft: "border-border bg-background text-text-secondary",
    pending: "border-accent/30 bg-accent/10 text-accent",
    accepted: "border-green-500/30 bg-green-500/10 text-green-300",
    declined: "border-red-500/30 bg-red-500/10 text-red-300",
  };

  const labels: Record<string, string> = {
    pending_review: "In Review",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        styles[status] || "border-border bg-background text-text-secondary"
      }`}
    >
      {labels[status] || status.replace(/_/g, " ")}
    </span>
  );
}

function getBoatHref(listing: SellerListing) {
  return listing.slug ? `/boats/${listing.slug}` : `/boats/${listing.id}`;
}

function formatMoney(amount: number, currency: string) {
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${Math.round(amount).toLocaleString("en-US")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
