import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["active", "rejected", "pending_review"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await query("UPDATE boats SET status = $1, updated_at = NOW() WHERE id = $2", [
    parsed.data.status,
    id,
  ]);

  return NextResponse.json({ success: true });
}
