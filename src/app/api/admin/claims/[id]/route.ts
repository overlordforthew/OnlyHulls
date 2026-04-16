import { requireRole } from "@/lib/auth";
import { updateClaimRequestStatus } from "@/lib/claims";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["draft_created", "reviewing", "approved", "rejected"]),
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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid claim status" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const claim = await updateClaimRequestStatus({
      claimId: id,
      status: parsed.data.status,
      reviewerUserId: user.id,
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim request not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, claim });
  } catch (err) {
    logger.error({ err, claimId: id }, "PATCH /api/admin/claims/[id] error");
    return NextResponse.json({ error: "Failed to update claim request" }, { status: 500 });
  }
}
