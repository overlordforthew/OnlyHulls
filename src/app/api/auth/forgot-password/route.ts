import { queryOne } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { getAuthAppUrl } from "@/lib/config/urls";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`forgot-pw:${ip}`, 3, 3600);
  if (!rl.allowed) {
    // Always return success to prevent email enumeration
    return NextResponse.json({ ok: true });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ ok: true });

  const user = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [email.toLowerCase().trim()]
  );

  if (user) {
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await queryOne(
      `UPDATE users SET password_reset_token = $1, password_reset_expires_at = $2 WHERE id = $3`,
      [token, expires, user.id]
    );

    try {
      await sendPasswordResetEmail({
        email: email.toLowerCase().trim(),
        resetUrl: `${getAuthAppUrl()}/reset-password?token=${token}`,
      });
    } catch {
      // Intentionally ignore delivery failures to avoid leaking account state.
    }
  }

  // Always return success to prevent email enumeration
  return NextResponse.json({ ok: true });
}
