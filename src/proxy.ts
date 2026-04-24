import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildContentSecurityPolicy, createCspNonce } from "@/lib/security/csp";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/i18n/config";

// Non-default locales that live under a path prefix (/es, ...). English stays
// at the root.
const PREFIXED_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
const LOCALE_PREFIX_PATTERN = PREFIXED_LOCALES.length
  ? new RegExp(`^/(${PREFIXED_LOCALES.join("|")})(?:/(.*))?$`)
  : null;

export function proxy(request: NextRequest) {
  const nonce = createCspNonce();
  const isProduction = process.env.NODE_ENV === "production";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Locale URL strategy: /es/<path> is rewritten internally to <path> and the
  // resolved locale is set on the REQUEST header so src/i18n/request.ts can
  // pick it up via `headers().get("x-locale")` on the server side. Non-prefixed
  // paths default to English.
  const { pathname, search } = request.nextUrl;
  const match = LOCALE_PREFIX_PATTERN ? pathname.match(LOCALE_PREFIX_PATTERN) : null;
  let response: NextResponse;
  if (match) {
    const locale = match[1];
    const rest = match[2] ? `/${match[2]}` : "/";
    requestHeaders.set("x-locale", locale);
    const rewritten = new URL(`${rest}${search}`, request.url);
    response = NextResponse.rewrite(rewritten, {
      request: { headers: requestHeaders },
    });
  } else {
    requestHeaders.set("x-locale", DEFAULT_LOCALE);
    response = NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (isProduction) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
