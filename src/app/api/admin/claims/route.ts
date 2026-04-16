import { listClaimRequests } from "@/lib/claims";
import { requireRole } from "@/lib/auth";
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
    const status = (url.searchParams.get("status") || "all").trim();
    const limitRaw = Number.parseInt(url.searchParams.get("limit") || "20", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

    const claims = await listClaimRequests({
      status:
        status === "draft_created" ||
        status === "reviewing" ||
        status === "approved" ||
        status === "rejected"
          ? status
          : "all",
      limit,
    });

    return NextResponse.json({ claims });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/claims error");
    return NextResponse.json({ error: "Failed to load claim requests" }, { status: 500 });
  }
}
