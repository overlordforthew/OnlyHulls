import { getStripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import type { SubscriptionTier } from "@/lib/config/plans";
import { PLANS } from "@/lib/config/plans";

// Map Stripe price IDs to tiers
function tierFromPriceId(priceId: string): SubscriptionTier | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.stripePriceId === priceId) return plan.tier;
  }
  return null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (subscriptionId) {
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const tier = tierFromPriceId(priceId);

        if (tier) {
          await query(
            `UPDATE users SET subscription_tier = $1, stripe_subscription_id = $2 WHERE stripe_customer_id = $3`,
            [tier, subscriptionId, customerId]
          );
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price.id;
      const tier = tierFromPriceId(priceId);

      if (tier) {
        await query(
          `UPDATE users SET subscription_tier = $1 WHERE stripe_customer_id = $2`,
          [tier, customerId]
        );
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;

      await query(
        `UPDATE users SET subscription_tier = 'free', stripe_subscription_id = NULL WHERE stripe_customer_id = $1`,
        [customerId]
      );
      break;
    }
  }

  return NextResponse.json({ received: true });
}
