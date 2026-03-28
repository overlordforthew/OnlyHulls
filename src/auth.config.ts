import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" as const },
  pages: { signIn: "/sign-in" },
  callbacks: {
    authorized() {
      // Allow all requests — pages handle their own auth
      return true;
    },
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  providers: [], // added in auth.ts with Credentials
  trustHost: true,
} satisfies NextAuthConfig;
