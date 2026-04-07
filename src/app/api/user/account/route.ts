import { auth } from "@/auth";
import { queryOne } from "@/lib/db";
import { logger } from "@/lib/logger";
import { billingEnabled, emailEnabled } from "@/lib/capabilities";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await queryOne<{
      subscription_tier: string;
      email_alerts: string;
      newsletter_opt_in: boolean;
      role: string;
    }>(
      "SELECT subscription_tier, email_alerts, newsletter_opt_in, role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...user,
      billing_enabled: billingEnabled(),
      email_enabled: emailEnabled(),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/user/account error");
    return NextResponse.json(
      { error: "Failed to load account. Please try again." },
      { status: 500 }
    );
  }
}
