import { requireRole } from "@/lib/auth";
import { backfillAllMatches } from "@/lib/admin/maintenance";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await backfillAllMatches();
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, "POST /api/admin/maintenance/backfill-matches error");
    return NextResponse.json(
      { error: "Failed to backfill matches" },
      { status: 500 }
    );
  }
}
