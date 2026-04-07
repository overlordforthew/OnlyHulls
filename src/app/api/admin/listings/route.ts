import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "pending_review";

    const listings = await query<Record<string, unknown>>(
      `SELECT b.id, b.slug, b.make, b.model, b.year, b.asking_price, b.currency,
              b.location_text, b.status, b.created_at, b.listing_source,
              u.email as seller_email
       FROM boats b
       JOIN users u ON u.id = b.seller_id
       WHERE b.status = $1
       ORDER BY b.created_at DESC
       LIMIT 50`,
      [status]
    );

    return NextResponse.json({ listings });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/listings error");
    return NextResponse.json(
      { error: "Failed to load listings" },
      { status: 500 }
    );
  }
}
