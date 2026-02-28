import { auth } from "@/auth";
import { queryOne } from "@/lib/db";
import { createCustomerPortalSession } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    `${appUrl}/pricing`
  );

  return NextResponse.json({ url });
}
