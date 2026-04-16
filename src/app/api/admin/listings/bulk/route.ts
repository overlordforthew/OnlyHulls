import { requireRole } from "@/lib/auth";
import { bulkUpdateListingStatus } from "@/lib/admin/maintenance";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";

const bulkSchema = z.object({
  status: z.enum(["active", "rejected", "pending_review", "expired"]),
  ids: z.array(z.string().uuid()).max(200).optional(),
});

export async function POST(req: Request) {
  try {
    await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await bulkUpdateListingStatus(parsed.data.status, parsed.data.ids);
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, "POST /api/admin/listings/bulk error");
    return NextResponse.json(
      { error: "Failed to update listings" },
      { status: 500 }
    );
  }
}
