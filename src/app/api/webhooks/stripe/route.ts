import { getStripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import type { SubscriptionTier } from "@/lib/config/plans";
import { PLANS } from "@/lib/config/plans";

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
  } catch (err) {
    logger.error({ err }, "Stripe webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const email = session.customer_details?.email;

        logger.info({ customerId, subscriptionId, email }, "Checkout completed");

        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          const tier = tierFromPriceId(priceId);

          if (tier) {
            await query(
              `UPDATE users SET subscription_tier = $1, stripe_subscription_id = $2 WHERE stripe_customer_id = $3`,
              [tier, subscriptionId, customerId]
            );
            logger.info({ tier, customerId }, "User tier updated from checkout");
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
          logger.info({ tier, customerId }, "Subscription updated");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        // Determine if buyer or seller based on current tier, reset to appropriate free tier
        const user = await query<{ role: string }>(
          "SELECT role FROM users WHERE stripe_customer_id = $1",
          [customerId]
        );
        const role = user[0]?.role;
        const freeTier = role === "seller" ? "free-seller" : "free";

        await query(
          `UPDATE users SET subscription_tier = $1, stripe_subscription_id = NULL WHERE stripe_customer_id = $2`,
          [freeTier, customerId]
        );
        logger.info({ customerId, freeTier }, "Subscription canceled, reverted to free");
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        logger.info(
          { customerId: invoice.customer, amount: invoice.amount_paid, currency: invoice.currency },
          "Invoice payment succeeded"
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        logger.warn(
          { customerId: invoice.customer, amount: invoice.amount_due, currency: invoice.currency },
          "Invoice payment FAILED"
        );
        // TODO: Send notification to user about failed payment
        break;
      }
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Webhook processing error");
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true });
}
