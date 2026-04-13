import { createCustomerPortalSession, getStripe } from "@/lib/stripe";
import { query, queryOne } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/config/urls";
import type { SubscriptionTier } from "@/lib/config/plans";
import { getPlanByTier, PLANS } from "@/lib/config/plans";
import { sendBillingIssueEmail, sendOwnerAlertEmail } from "@/lib/email/resend";
import { trackFunnelEvent } from "@/lib/funnel";

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

        logger.info({ customerId, subscriptionId }, "Checkout completed");

        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          const tier = tierFromPriceId(priceId);

          if (tier) {
            await query(
              `UPDATE users SET subscription_tier = $1, stripe_subscription_id = $2 WHERE stripe_customer_id = $3`,
              [tier, subscriptionId, customerId]
            );

            const user = await queryOne<{ id: string | null }>(
              "SELECT id FROM users WHERE stripe_customer_id = $1",
              [customerId]
            );

            await trackFunnelEvent({
              eventType: "checkout_completed",
              userId: user?.id || null,
              payload: {
                tier,
                subscriptionId,
                priceId: priceId || null,
              },
            });
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
        const customerId = invoice.customer as string;
        const user = customerId
          ? await queryOne<{
              id: string | null;
              subscription_tier: SubscriptionTier | null;
            }>("SELECT id, subscription_tier FROM users WHERE stripe_customer_id = $1", [customerId])
          : null;

        await trackFunnelEvent({
          eventType: "invoice_payment_succeeded",
          userId: user?.id || null,
          payload: {
            amountPaid: typeof invoice.amount_paid === "number" ? invoice.amount_paid : null,
            currency: invoice.currency || null,
            planTier: user?.subscription_tier || null,
          },
        });
        logger.info(
          { customerId, amount: invoice.amount_paid, currency: invoice.currency },
          "Invoice payment succeeded"
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;
        logger.warn(
          { customerId, amount: invoice.amount_due, currency: invoice.currency },
          "Invoice payment FAILED"
        );

        const user = await queryOne<{
          id: string | null;
          email: string;
          display_name: string | null;
          subscription_tier: SubscriptionTier | null;
        }>(
          "SELECT id, email, display_name, subscription_tier FROM users WHERE stripe_customer_id = $1",
          [customerId]
        );

        const planName = getPlanByTier(user?.subscription_tier || "free").name;

        await trackFunnelEvent({
          eventType: "invoice_payment_failed",
          userId: user?.id || null,
          payload: {
            amountDue: typeof invoice.amount_due === "number" ? invoice.amount_due : null,
            currency: invoice.currency || null,
            planTier: user?.subscription_tier || null,
            planName,
            invoiceId: invoice.id || null,
          },
        });

        if (user?.email) {
          try {
            const portalUrl = await createCustomerPortalSession(
              customerId,
              `${getPublicAppUrl()}/account`
            );

            await sendBillingIssueEmail({
              email: user.email,
              displayName: user.display_name,
              planName,
              updateBillingUrl: portalUrl,
            });
          } catch (err) {
            logger.warn({ err, customerId }, "Failed to send billing issue email");
          }
        }

        try {
          await sendOwnerAlertEmail({
            subject: `OnlyHulls payment failed: ${user?.email || customerId}`,
            title: "Stripe payment failed",
            intro: "A subscription renewal or invoice payment failed and may need follow-up.",
            metadata: [
              { label: "Customer", value: user?.email || customerId },
              { label: "Display name", value: user?.display_name || "Not provided" },
              { label: "Plan", value: planName },
              {
                label: "Amount due",
                value:
                  typeof invoice.amount_due === "number"
                    ? `${invoice.currency?.toUpperCase() || "USD"} ${(invoice.amount_due / 100).toFixed(2)}`
                    : null,
              },
              { label: "Invoice ID", value: invoice.id || null },
            ],
            ctaUrl: `${getPublicAppUrl()}/admin`,
            ctaLabel: "Open admin dashboard",
          });
        } catch (err) {
          logger.warn({ err, customerId }, "Failed to send owner billing alert");
        }
        break;
      }
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Webhook processing error");
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true });
}
