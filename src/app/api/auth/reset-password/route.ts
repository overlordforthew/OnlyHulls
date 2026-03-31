import { queryOne } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { token, password } = parsed.data;

  const user = await queryOne<{ id: string }>(
    `SELECT id FROM users
     WHERE password_reset_token = $1
       AND password_reset_expires_at > NOW()`,
    [token]
  );

  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  await queryOne(
    `UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = $2`,
    [hash, user.id]
  );

  return NextResponse.json({ ok: true });
}
