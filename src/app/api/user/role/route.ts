import { auth } from "@clerk/nextjs/server";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const roleSchema = z.object({
  role: z.enum(["buyer", "seller", "both"]),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const user = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE clerk_id = $1",
    [userId]
  );

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await query("UPDATE users SET role = $1 WHERE clerk_id = $2", [
    parsed.data.role,
    userId,
  ]);

  return NextResponse.json({ success: true, role: parsed.data.role });
}
