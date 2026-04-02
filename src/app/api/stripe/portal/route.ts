import { auth } from "@/auth";
import { queryOne } from "@/lib/db";
import { createCustomerPortalSession } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await queryOne<{ stripe_customer_id: string | null }>(
      "SELECT stripe_customer_id FROM users WHERE id = $1",
      [session.user.id]
    );

    if (!user?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = await createCustomerPortalSession(
      user.stripe_customer_id,
      `${appUrl}/sell#pricing`
    );

    return NextResponse.json({ url });
  } catch (err) {
    logger.error({ err }, "POST /api/stripe/portal error");
    return NextResponse.json(
      { error: "Failed to open billing portal. Please try again." },
      { status: 500 }
    );
  }
}
