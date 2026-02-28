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

  const user = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE id = $1",
    [session.user.id]
  );

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await query("UPDATE users SET role = $1 WHERE id = $2", [
    parsed.data.role,
    session.user.id,
  ]);

  return NextResponse.json({ success: true, role: parsed.data.role });
}
