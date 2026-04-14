import { requireRole } from "@/lib/auth";
import { cleanImportedListings } from "@/lib/admin/maintenance";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number };
    const requestedLimit = Number(body.limit);
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), 2000)
        : 500;

    const result = await cleanImportedListings(limit);
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, "POST /api/admin/maintenance/clean-imports error");
    return NextResponse.json(
      { error: "Failed to clean imported listings" },
      { status: 500 }
    );
  }
}
