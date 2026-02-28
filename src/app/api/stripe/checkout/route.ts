import { auth } from "@clerk/nextjs/server";
import { queryOne, query } from "@/lib/db";
import {
  createCheckoutSession,
  getOrCreateCustomer,
} from "@/lib/stripe";
import { PLANS } from "@/lib/config/plans";
import { NextResponse } from "next/server";
import { z } from "zod";

const checkoutSchema = z.object({
  tier: z.enum(["plus", "pro", "standard", "featured", "broker"]),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
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
  }>("SELECT id, email, display_name, stripe_customer_id FROM users WHERE clerk_id = $1", [
    userId,
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

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
    `${appUrl}/pricing`
  );

  return NextResponse.json({ url });
}
