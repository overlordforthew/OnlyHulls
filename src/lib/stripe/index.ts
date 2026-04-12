import Stripe from "stripe";
import { logger } from "@/lib/logger";
import { billingEnabled } from "@/lib/capabilities";

let _stripe: Stripe | null = null;

export interface CustomerBillingSummary {
  hasCustomer: boolean;
  subscriptionStatus: string | null;
  latestInvoiceStatus: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  amountDue: number | null;
  currency: string | null;
  billingIssue: boolean;
  billingIssueMessage: string | null;
}

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!billingEnabled()) {
      logger.warn("Stripe billing is not configured");
      throw new Error("Billing is not configured");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  userId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  try {
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
    });
    return session.url || "";
  } catch (err) {
    logger.error({ err, customerId, priceId }, "Stripe checkout session creation failed");
    throw new Error("Failed to create checkout session");
  }
}

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  } catch (err) {
    logger.error({ err, customerId }, "Stripe portal session creation failed");
    throw new Error("Failed to create billing portal session");
  }
}

function getBillingIssueMessage(summary: {
  subscriptionStatus: string | null;
  latestInvoiceStatus: string | null;
  amountDue: number | null;
  currency: string | null;
}) {
  if (summary.subscriptionStatus === "past_due" || summary.subscriptionStatus === "unpaid") {
    return summary.amountDue && summary.currency
      ? `Payment is overdue on your subscription. Stripe is waiting on ${summary.currency.toUpperCase()} ${(summary.amountDue / 100).toFixed(2)}.`
      : "Payment is overdue on your subscription. Update your billing method to keep your plan active.";
  }

  if (
    summary.subscriptionStatus === "incomplete" ||
    summary.subscriptionStatus === "incomplete_expired"
  ) {
    return "Your subscription setup was not completed. Update billing to finish activating your plan.";
  }

  if (summary.latestInvoiceStatus === "open" && (summary.amountDue ?? 0) > 0) {
    return summary.currency
      ? `There is an open invoice for ${summary.currency.toUpperCase()} ${(summary.amountDue! / 100).toFixed(2)}.`
      : "There is an open invoice on your account.";
  }

  return null;
}

export async function getCustomerBillingSummary(
  customerId: string
): Promise<CustomerBillingSummary> {
  const subscriptions = await getStripe().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 5,
    expand: ["data.latest_invoice"],
  });

  const subscription =
    subscriptions.data.find((item) =>
      ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(item.status)
    ) || subscriptions.data[0];

  const latestInvoice =
    subscription?.latest_invoice && typeof subscription.latest_invoice !== "string"
      ? subscription.latest_invoice
      : null;

  const summary: CustomerBillingSummary = {
    hasCustomer: true,
    subscriptionStatus: subscription?.status || null,
    latestInvoiceStatus: latestInvoice?.status || null,
    renewsAt: subscription?.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : subscription?.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : latestInvoice?.period_end
          ? new Date(latestInvoice.period_end * 1000).toISOString()
      : null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    amountDue:
      typeof latestInvoice?.amount_due === "number" ? latestInvoice.amount_due : null,
    currency: latestInvoice?.currency || null,
    billingIssue: false,
    billingIssueMessage: null,
  };

  summary.billingIssue = Boolean(
    summary.subscriptionStatus &&
      ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(summary.subscriptionStatus)
  ) || (summary.latestInvoiceStatus === "open" && (summary.amountDue ?? 0) > 0);
  summary.billingIssueMessage = getBillingIssueMessage(summary);

  return summary;
}

export async function getOrCreateCustomer(
  email: string,
  name?: string | null
): Promise<string> {
  try {
    const existing = await getStripe().customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      return existing.data[0].id;
    }
    const customer = await getStripe().customers.create({
      email,
      name: name || undefined,
    });
    return customer.id;
  } catch (err) {
    logger.error({ err, email }, "Stripe customer lookup/creation failed");
    throw new Error("Failed to create Stripe customer");
  }
}
