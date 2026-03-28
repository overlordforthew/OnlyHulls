import { auth } from "@/auth";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email_alerts, newsletter_opt_in } = await req.json();

  const validAlerts = ["none", "weekly", "instant"];
  if (!validAlerts.includes(email_alerts)) {
    return NextResponse.json({ error: "Invalid email_alerts value" }, { status: 400 });
  }

  await query(
    "UPDATE users SET email_alerts = $1, newsletter_opt_in = $2 WHERE id = $3",
    [email_alerts, Boolean(newsletter_opt_in), session.user.id]
  );

  return NextResponse.json({ ok: true });
}
