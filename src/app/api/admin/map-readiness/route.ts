import { requireRole } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getMapReadinessSnapshot } from "@/lib/locations/map-readiness-data";
import type { MapReadinessSnapshot } from "@/lib/locations/map-readiness";
import { NextResponse } from "next/server";

type RequireAdmin = () => Promise<unknown>;
type LoadSnapshot = () => Promise<MapReadinessSnapshot>;

export async function buildAdminMapReadinessResponse(
  requireAdmin: RequireAdmin,
  loadSnapshot: LoadSnapshot
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const snapshot = await loadSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    logger.error({ err }, "GET /api/admin/map-readiness error");
    return NextResponse.json({ error: "Failed to load map readiness" }, { status: 500 });
  }
}

export async function GET() {
  return buildAdminMapReadinessResponse(
    () => requireRole(["admin"]),
    getMapReadinessSnapshot
  );
}
