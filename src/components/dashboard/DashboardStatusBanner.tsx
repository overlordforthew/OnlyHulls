import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { queryOne } from "@/lib/db";
import { billingEnabled } from "@/lib/capabilities";
import { getCustomerBillingSummary } from "@/lib/stripe";

function formatBillingDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function DashboardStatusBanner({ userId }: { userId: string }) {
  if (!billingEnabled()) {
    return null;
  }

  const user = await queryOne<{
    subscription_tier: string;
    stripe_customer_id: string | null;
  }>(
    `SELECT subscription_tier, stripe_customer_id
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (!user || user.subscription_tier.startsWith("free") || !user.stripe_customer_id) {
    return null;
  }

  const billingSummary = await getCustomerBillingSummary(user.stripe_customer_id).catch(() => null);

  if (!billingSummary) {
    return null;
  }

  if (billingSummary.billingIssue) {
    return (
      <div className="border-b border-amber-500/20 bg-amber-500/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3 text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="font-semibold text-amber-300">Billing needs attention</p>
              <p className="mt-1 text-amber-100/90">
                {billingSummary.billingIssueMessage ||
                  "There is a billing issue on your account. Update the payment method to keep paid access active."}
              </p>
            </div>
          </div>
          <Link
            href="/account"
            className="inline-flex rounded-full border border-amber-400/30 px-4 py-2 text-sm font-medium text-amber-100 transition-all hover:border-amber-300 hover:text-white"
          >
            Open billing
          </Link>
        </div>
      </div>
    );
  }

  if (billingSummary.cancelAtPeriodEnd) {
    const renewalLabel = formatBillingDate(billingSummary.renewsAt);

    return (
      <div className="border-b border-border bg-surface/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3 text-text-secondary">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold text-foreground">Paid plan set to end</p>
              <p className="mt-1">
                {renewalLabel
                  ? `Your current plan will end on ${renewalLabel} unless you resume billing.`
                  : "Your current plan is set to end at the close of the current billing period."}
              </p>
            </div>
          </div>
          <Link
            href="/account"
            className="inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
          >
            Review billing
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
