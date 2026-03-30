import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["active", "rejected", "pending_review"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const boat = await queryOne<{ status: string; make: string; model: string }>(
    "SELECT status, make, model FROM boats WHERE id = $1",
    [id]
  );

  await query("UPDATE boats SET status = $1, updated_at = NOW() WHERE id = $2", [
    parsed.data.status,
    id,
  ]);

  logger.info(
    {
      action: "admin.listing.status_change",
      adminId: user.id,
      adminEmail: user.email,
      listingId: id,
      previousStatus: boat?.status,
      newStatus: parsed.data.status,
      boat: boat ? `${boat.make} ${boat.model}` : id,
    },
    "Admin changed listing status"
  );

  return NextResponse.json({ success: true });
}
