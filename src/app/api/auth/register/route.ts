import { queryOne } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
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
  // Skip if the IP cannot be determined — avoids blocking all users under a shared unknown key.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) {
    const rl = await rateLimit(`register:${ip}`, 5, 3600);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }
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

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );
  if (existing) {
    // Return generic error to prevent user enumeration
    return NextResponse.json(
      { error: "Unable to create account. Please check your information and try again." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await queryOne(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [email, passwordHash, displayName || null]
  );

  return NextResponse.json({ success: true });
}
