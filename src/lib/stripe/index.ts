import Stripe from "stripe";
import { logger } from "@/lib/logger";
import { billingEnabled } from "@/lib/capabilities";

let _stripe: Stripe | null = null;

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
