import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { authConfig } from "./auth.config";
import { rateLimit } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Rate limit per IP+email: 10 attempts per 15 minutes.
        // Keyed on IP so attackers cannot lock out arbitrary accounts.
        const ip =
          (request as Request | undefined)?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        const rl = await rateLimit(`login:${ip}:${email.toLowerCase()}`, 10, 900);
        if (!rl.allowed) return null;

        const user = await queryOne<{
          id: string;
          email: string;
          display_name: string | null;
          password_hash: string | null;
        }>(
          "SELECT id, email, display_name, password_hash FROM users WHERE email = $1",
          [email]
        );

        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.display_name };
      },
    }),
  ],
});
