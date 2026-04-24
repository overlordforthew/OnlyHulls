import { NextRequest, NextResponse } from "next/server";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/i18n/config";

// Locale URL strategy:
//   - English is served at the root (/boats, /catamarans-for-sale, etc.)
//   - Spanish is served with an /es prefix (/es/boats, /es/catamarans-for-sale)
// This middleware rewrites the /es/* URL to the underlying route and sets an
// x-locale header so src/i18n/request.ts can pick the locale without the
// cookie-based heuristic that previously caused duplicate-content issues.

const LOCALE_PREFIX_PATTERN = new RegExp(
  `^/(${SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).join("|")})(/.*)?$`
);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Skip Next.js internals and static assets.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const match = pathname.match(LOCALE_PREFIX_PATTERN);
  if (match) {
    const locale = match[1];
    const rest = match[2] || "/";
    const rewritten = new URL(rest + search, request.url);
    const response = NextResponse.rewrite(rewritten);
    response.headers.set("x-locale", locale);
    return response;
  }

  // English path — explicitly mark the locale so downstream code doesn't fall
  // back to cookie/Accept-Language guessing and serve the wrong language at a
  // canonical URL.
  const response = NextResponse.next();
  response.headers.set("x-locale", DEFAULT_LOCALE);
  return response;
}

export const config = {
  // Run on every path except Next static / API. The matcher pattern excludes
  // internal Next.js routes plus anything with a file extension.
  matcher: ["/((?!_next|api|favicon|.*\\..*).*)"],
};
