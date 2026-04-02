import { auth } from "@/auth";
import { queryOne, query } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  createCheckoutSession,
  getOrCreateCustomer,
} from "@/lib/stripe";
import { PLANS } from "@/lib/config/plans";
import { NextResponse } from "next/server";
import { z } from "zod";

const checkoutSchema = z.object({
  tier: z.enum(["plus", "standard", "featured", "broker"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const plan = PLANS[parsed.data.tier];
  if (!plan || !plan.stripePriceId) {
    return NextResponse.json(
      { error: "Plan not configured" },
      { status: 400 }
    );
  }

  const user = await queryOne<{
    id: string;
    email: string;
    display_name: string | null;
    stripe_customer_id: string | null;
  }>("SELECT id, email, display_name, stripe_customer_id FROM users WHERE id = $1", [
    session.user.id,
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      customerId = await getOrCreateCustomer(user.email, user.display_name);
      await query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [
        customerId,
        user.id,
      ]);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = await createCheckoutSession(
      customerId,
      plan.stripePriceId,
      user.id,
      `${appUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      `${appUrl}/sell#pricing`
    );

    return NextResponse.json({ url });
  } catch (err) {
    logger.error({ err }, "POST /api/stripe/checkout error");
    return NextResponse.json(
      { error: "Failed to start checkout. Please try again." },
      { status: 500 }
    );
  }
}
