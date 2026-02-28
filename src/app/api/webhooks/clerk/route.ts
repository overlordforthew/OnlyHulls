import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const eventType = evt.type;

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name } = evt.data;
    const email = email_addresses?.[0]?.email_address;
    const displayName =
      [first_name, last_name].filter(Boolean).join(" ") || null;

    if (!email) {
      return NextResponse.json(
        { error: "No email in webhook data" },
        { status: 400 }
      );
    }

    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE clerk_id = $1",
      [id]
    );

    if (existing) {
      await query(
        `UPDATE users SET email = $1, display_name = $2, last_active = NOW() WHERE clerk_id = $3`,
        [email, displayName, id]
      );
    } else {
      await query(
        `INSERT INTO users (clerk_id, email, display_name) VALUES ($1, $2, $3)`,
        [id, email, displayName]
      );
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;
    if (id) {
      await query("DELETE FROM users WHERE clerk_id = $1", [id]);
    }
  }

  return NextResponse.json({ received: true });
}
