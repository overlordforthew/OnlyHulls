import { NextResponse } from "next/server";
import { auth } from "./src/auth";

const PROTECTED_PREFIXES = [
  "/account",
  "/admin",
  "/listings",
  "/matches",
  "/onboarding",
  "/saved-searches",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default auth((req) => {
  if (req.auth || !isProtectedPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const signInUrl = new URL("/sign-in", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/listings/:path*", "/matches/:path*", "/onboarding/:path*", "/saved-searches/:path*"],
};
