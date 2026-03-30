import { queryOne } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email/resend";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().optional(),
});

export async function POST(req: Request) {
  // Rate limit: 5 registrations per IP per hour.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`register:${ip}`, 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { email, password, displayName } = parsed.data;

  // Always hash the password first to prevent timing-based email enumeration
  // (bcrypt takes ~100ms — without this, existing-email responses are instant)
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );
  if (existing) {
    return NextResponse.json(
      { error: "Unable to create account. Please check your information and try again." },
      { status: 400 }
    );
  }

  const verifyToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const newUser = await queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name, email_verified, email_verify_token, email_verify_token_expires_at)
     VALUES ($1, $2, $3, false, $4, $5)
     RETURNING id`,
    [email, passwordHash, displayName || null, verifyToken, expiresAt.toISOString()]
  );

  if (newUser) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://onlyhulls.com";
    try {
      await sendVerificationEmail({
        email,
        verifyUrl: `${appUrl}/api/auth/verify?token=${verifyToken}`,
      });
    } catch {
      // Email failed — mark user as verified so they aren't stranded
      await queryOne(
        "UPDATE users SET email_verified = true, email_verify_token = NULL WHERE id = $1",
        [newUser.id]
      );
    }
  }

  return NextResponse.json({ success: true, requiresVerification: true });
}
