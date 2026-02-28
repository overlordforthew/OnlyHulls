import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [users, listings, pending, matches, intros] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*) FROM users"),
    queryOne<{ count: string }>("SELECT COUNT(*) FROM boats WHERE status = 'active'"),
    queryOne<{ count: string }>("SELECT COUNT(*) FROM boats WHERE status = 'pending_review'"),
    queryOne<{ count: string }>("SELECT COUNT(*) FROM matches"),
    queryOne<{ count: string }>("SELECT COUNT(*) FROM introductions"),
  ]);

  return NextResponse.json({
    totalUsers: parseInt(users?.count || "0"),
    activeListings: parseInt(listings?.count || "0"),
    pendingListings: parseInt(pending?.count || "0"),
    totalMatches: parseInt(matches?.count || "0"),
    totalIntroductions: parseInt(intros?.count || "0"),
  });
}
