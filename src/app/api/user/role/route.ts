import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const roleSchema = z.object({
  role: z.enum(["buyer", "seller", "both"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const user = await queryOne<{ id: string; role: string; subscription_tier: string }>(
    "SELECT id, role, subscription_tier FROM users WHERE id = $1",
    [session.user.id]
  );

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const targetRole = parsed.data.role;

  // Buyer → buyer is always allowed (no-op)
  // Seller/both requires a seller-tier subscription (free-seller, standard, featured, broker)
  const sellerTiers = ["free-seller", "standard", "featured", "broker"];
  if ((targetRole === "seller" || targetRole === "both") && !sellerTiers.includes(user.subscription_tier)) {
    return NextResponse.json(
      { error: "A seller plan is required to list boats. Visit /pricing to get started." },
      { status: 403 }
    );
  }

  await query("UPDATE users SET role = $1 WHERE id = $2", [
    targetRole,
    session.user.id,
  ]);

  return NextResponse.json({ success: true, role: targetRole });
}
