import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const publicRoutes = [
  "/",
  "/sign-in",
  "/sign-up",
  "/boats",
  "/pricing",
  "/match",
  "/sell",
  "/api/auth",
  "/api/webhooks",
  "/api/cron",
  "/sitemap.xml",
  "/robots.txt",
];

function isPublic(pathname: string): boolean {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export default auth((req) => {
  // Block all server action requests — no server actions exist in this build
  const actionId = req.headers.get("Next-Action");
  if (actionId !== null) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Block legacy Clerk auth endpoints (migrated to Auth.js)
  if (req.nextUrl.pathname.startsWith("/api/auth/v1/")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (isPublic(req.nextUrl.pathname)) return NextResponse.next();

  if (!req.auth?.user) {
    const signIn = new URL("/sign-in", req.nextUrl.origin);
    signIn.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
