import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { sendOwnerAlertEmail, sendSellerNotification } from "@/lib/email/resend";
import { getPlanByTier } from "@/lib/config/plans";
import { emailEnabled } from "@/lib/capabilities";
import { getPublicAppUrl } from "@/lib/config/urls";
import { scoreBoatForBuyer } from "@/lib/matching/heuristic";
import { trackFunnelEvent } from "@/lib/funnel";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";

const connectSchema = z
  .object({
    matchId: z.string().uuid().optional(),
    boatId: z.string().uuid().optional(),
    message: z.string().optional(),
  })
  .refine((value) => Boolean(value.matchId || value.boatId), {
    message: "Either matchId or boatId is required",
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

  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await queryOne<{
    id: string;
    email: string;
    display_name: string | null;
    subscription_tier: string;
    role: string;
  }>(
    "SELECT id, email, display_name, subscription_tier, role FROM users WHERE id = $1",
    [session.user.id]
  );
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const effectiveTier =
    user.subscription_tier === "free-seller" && user.role === "both"
      ? "free"
      : user.subscription_tier;
  const plan = getPlanByTier(effectiveTier as Parameters<typeof getPlanByTier>[0]);
  if (plan.limits.connectsPerMonth === 0) {
    return NextResponse.json(
      { error: "Upgrade to Plus or Pro to connect with sellers" },
      { status: 403 }
    );
  }

  const match = parsed.data.matchId
    ? await queryOne<{
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
      )
    : await getOrCreateMatchForBoat(user.id, parsed.data.boatId!);

  if (!match) {
    return NextResponse.json(
      {
        error: parsed.data.matchId
          ? "Match not found"
          : "Complete your buyer profile before contacting sellers.",
        requiresProfile: !parsed.data.matchId,
      },
      { status: parsed.data.matchId ? 404 : 409 }
    );
  }

  if (match.seller_id === user.id) {
    return NextResponse.json(
      { error: "You cannot contact your own listing." },
      { status: 400 }
    );
  }

  const existingIntroduction = await queryOne<{
    id: string;
    status: string;
  }>(
    `SELECT id, status
     FROM introductions
     WHERE match_id = $1
       AND buyer_id = $2
       AND status IN ('pending', 'accepted')
     ORDER BY sent_at DESC
     LIMIT 1`,
    [match.id, user.id]
  );

  if (existingIntroduction) {
    return NextResponse.json({
      success: true,
      alreadyRequested: true,
      sellerContact: {
        email: match.seller_email,
        name: match.seller_name,
      },
    });
  }

  const acceptToken = randomBytes(32).toString("hex");
  const declineToken = randomBytes(32).toString("hex");

  const limitClause =
    plan.limits.connectsPerMonth > 0
      ? `AND (SELECT COUNT(*) FROM introductions WHERE buyer_id = $2 AND sent_at > NOW() - INTERVAL '30 days') < ${plan.limits.connectsPerMonth}`
      : "";

  const intro = await queryOne<{ id: string }>(
    `INSERT INTO introductions (match_id, buyer_id, seller_id, accept_token, decline_token, buyer_message)
     SELECT $1, $2, $3, $4, $5, $6
     WHERE TRUE ${limitClause}
     RETURNING id`,
    [
      match.id,
      user.id,
      match.seller_id,
      acceptToken,
      declineToken,
      parsed.data.message || null,
    ]
  );

  if (!intro) {
    return NextResponse.json(
      { error: `You've used all ${plan.limits.connectsPerMonth} connects this month` },
      { status: 403 }
    );
  }

  await trackFunnelEvent({
    eventType: "connect_requested",
    userId: user.id,
    boatId: match.boat_id,
    introductionId: intro.id,
    payload: { fromMatch: Boolean(parsed.data.matchId) },
  });

  try {
    await sendOwnerAlertEmail({
      subject: `New connect request: ${match.boat_title}`,
      title: "New buyer connect request",
      intro: "A buyer has requested a seller connection on OnlyHulls.",
      metadata: [
        { label: "Boat", value: match.boat_title },
        { label: "Buyer", value: `${user.display_name || "Unnamed buyer"} (${user.email})` },
        { label: "Seller", value: `${match.seller_name || "Unnamed seller"} (${match.seller_email})` },
        { label: "Match score", value: `${Math.round(match.score * 100)}%` },
        { label: "Requested from", value: parsed.data.matchId ? "Matches" : "Direct boat page" },
      ],
      ctaUrl: `${getPublicAppUrl()}/admin`,
      ctaLabel: "Review in admin",
    });
  } catch (err) {
    logger.warn({ err, matchId: match.id }, "Failed to send owner connect alert");
  }

  const canSendEmail = emailEnabled();
  if (!canSendEmail) {
    await query(
      `UPDATE introductions
       SET status = 'accepted',
           responded_at = NOW(),
           intro_sent_at = COALESCE(intro_sent_at, NOW())
       WHERE id = $1`,
      [intro.id]
    );
  }

  if (canSendEmail) {
    try {
      await sendSellerNotification({
        sellerEmail: match.seller_email,
        sellerName: match.seller_name || "",
        buyerSummary: `${user.display_name || "A buyer"} (${user.email}) is interested in your boat.`,
        boatTitle: match.boat_title,
        matchScore: match.score,
        acceptUrl: `${getPublicAppUrl()}/api/introductions/${acceptToken}?action=accept`,
        declineUrl: `${getPublicAppUrl()}/api/introductions/${declineToken}?action=decline`,
      });
    } catch (err) {
      logger.error({ err }, "Failed to send seller notification email");
    }
  }

  try {
    await query("UPDATE matches SET seller_notified = true WHERE id = $1", [
      match.id,
    ]);
  } catch (err) {
    logger.error({ err }, "Failed to update match notification flag");
  }

  return NextResponse.json({
    success: true,
    sellerContact: {
      email: match.seller_email,
      name: match.seller_name,
    },
  });
}

async function getOrCreateMatchForBoat(userId: string, boatId: string) {
  const buyer = await queryOne<{
    id: string;
    use_case: string[];
    budget_range: Record<string, unknown>;
    boat_type_prefs: Record<string, unknown>;
    spec_preferences: Record<string, unknown>;
    location_prefs: Record<string, unknown>;
    refit_tolerance: string;
  }>(
    `SELECT id, use_case, budget_range, boat_type_prefs, spec_preferences,
            location_prefs, refit_tolerance
     FROM buyer_profiles
     WHERE user_id = $1`,
    [userId]
  );

  if (!buyer) {
    return null;
  }

  const boat = await queryOne<{
    id: string;
    make: string;
    model: string;
    year: number;
    asking_price: number;
    currency: string;
    location_text: string | null;
    seller_id: string;
    seller_email: string;
    seller_name: string | null;
    specs: Record<string, unknown>;
    condition_score: number | null;
    character_tags: string[];
    ai_summary: string | null;
  }>(
    `SELECT b.id, b.make, b.model, b.year, b.asking_price, b.currency, b.location_text,
            b.seller_id,
            u.email as seller_email,
            u.display_name as seller_name,
            COALESCE(d.specs, '{}') as specs,
            d.condition_score,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.ai_summary
     FROM boats b
     JOIN users u ON u.id = b.seller_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.id = $1
       AND b.status = 'active'
       AND b.source_url IS NULL`,
    [boatId]
  );

  if (!boat) {
    return null;
  }

  const scored = scoreBoatForBuyer(buyer, boat);
  const match = await queryOne<{ id: string }>(
    `INSERT INTO matches (buyer_id, boat_id, score, score_breakdown)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (buyer_id, boat_id)
     DO UPDATE SET score = $3, score_breakdown = $4, updated_at = NOW()
     RETURNING id`,
    [buyer.id, boat.id, scored.score, JSON.stringify(scored.breakdown)]
  );

  if (!match) {
    return null;
  }

  return {
    id: match.id,
    score: scored.score,
    boat_id: boat.id,
    boat_title: `${boat.year} ${boat.make} ${boat.model}`,
    seller_id: boat.seller_id,
    seller_email: boat.seller_email,
    seller_name: boat.seller_name,
  };
}
