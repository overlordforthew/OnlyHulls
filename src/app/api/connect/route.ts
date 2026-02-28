import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { sendSellerNotification } from "@/lib/email/resend";
import { getPlanByTier } from "@/lib/config/plans";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";

const connectSchema = z.object({
  matchId: z.string().uuid(),
  message: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await queryOne<{
    id: string;
    email: string;
    display_name: string | null;
    subscription_tier: string;
  }>(
    "SELECT id, email, display_name, subscription_tier FROM users WHERE id = $1",
    [session.user.id]
  );
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check tier limits
  const plan = getPlanByTier(user.subscription_tier as Parameters<typeof getPlanByTier>[0]);
  if (plan.limits.connectsPerMonth === 0) {
    return NextResponse.json(
      { error: "Upgrade to Plus or Pro to connect with sellers" },
      { status: 403 }
    );
  }

  // Check monthly connect count
  if (plan.limits.connectsPerMonth > 0) {
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM introductions
       WHERE buyer_id = $1 AND sent_at > NOW() - INTERVAL '30 days'`,
      [user.id]
    );
    if (parseInt(countResult?.count || "0") >= plan.limits.connectsPerMonth) {
      return NextResponse.json(
        { error: `You've used all ${plan.limits.connectsPerMonth} connects this month` },
        { status: 403 }
      );
    }
  }

  // Get match details
  const match = await queryOne<{
    id: string;
    score: number;
    boat_id: string;
    boat_title: string;
    seller_id: string;
    seller_email: string;
    seller_name: string | null;
  }>(
    `SELECT m.id, m.score, m.boat_id,
            CONCAT(b.year, ' ', b.make, ' ', b.model) as boat_title,
            b.seller_id,
            u.email as seller_email,
            u.display_name as seller_name
     FROM matches m
     JOIN boats b ON b.id = m.boat_id
     JOIN users u ON u.id = b.seller_id
     JOIN buyer_profiles bp ON bp.id = m.buyer_id
     WHERE m.id = $1 AND bp.user_id = $2`,
    [parsed.data.matchId, user.id]
  );

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Generate accept/decline tokens
  const acceptToken = randomBytes(32).toString("hex");
  const declineToken = randomBytes(32).toString("hex");

  // Create introduction record
  await query(
    `INSERT INTO introductions (match_id, buyer_id, seller_id, accept_token, decline_token, buyer_message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      match.id,
      user.id,
      match.seller_id,
      acceptToken,
      declineToken,
      parsed.data.message || null,
    ]
  );

  // Send seller notification email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await sendSellerNotification({
    sellerEmail: match.seller_email,
    sellerName: match.seller_name || "",
    buyerSummary: `${user.display_name || "A buyer"} (${user.email}) is interested in your boat.`,
    boatTitle: match.boat_title,
    matchScore: match.score,
    acceptUrl: `${appUrl}/api/introductions/${acceptToken}?action=accept`,
    declineUrl: `${appUrl}/api/introductions/${declineToken}?action=decline`,
  });

  // Update match
  await query("UPDATE matches SET seller_notified = true WHERE id = $1", [
    match.id,
  ]);

  return NextResponse.json({ success: true });
}
