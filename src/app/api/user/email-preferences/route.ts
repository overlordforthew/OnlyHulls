import { auth } from "@/auth";
import { query } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

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

  const { email_alerts, newsletter_opt_in } = body;

  const validAlerts = ["none", "weekly", "instant"];
  if (!validAlerts.includes(email_alerts)) {
    return NextResponse.json({ error: "Invalid email_alerts value" }, { status: 400 });
  }

  try {
    await query(
      "UPDATE users SET email_alerts = $1, newsletter_opt_in = $2 WHERE id = $3",
      [email_alerts, Boolean(newsletter_opt_in), session.user.id]
    );
  } catch (err) {
    logger.error({ err }, "POST /api/user/email-preferences error");
    return NextResponse.json(
      { error: "Failed to save preferences. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
