import assert from "node:assert/strict";
import test from "node:test";
import { buildContentSecurityPolicy } from "../../src/lib/security/csp";

test("production CSP uses nonce-based scripts without inline script allowances", () => {
  const csp = buildContentSecurityPolicy("prodNonce123", { isDevelopment: false });

  assert.match(csp, /script-src 'self' 'nonce-prodNonce123' https:\/\/\*\.posthog\.com/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test("development CSP keeps the nonce policy but allows local dev tooling", () => {
  const csp = buildContentSecurityPolicy("devNonce456", { isDevelopment: true });

  assert.match(csp, /script-src 'self' 'nonce-devNonce456' https:\/\/\*\.posthog\.com 'unsafe-eval'/);
  assert.match(csp, /connect-src[^;]*ws:\/\/127\.0\.0\.1:\*/);
  assert.match(csp, /connect-src[^;]*http:\/\/localhost:\*/);
});

test("production CSP adds configured map origins only when client map capability is enabled", () => {
  const previous = {
    NEXT_PUBLIC_MAP_ENABLED: process.env.NEXT_PUBLIC_MAP_ENABLED,
    NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
    NEXT_PUBLIC_MAP_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
    NEXT_PUBLIC_MAP_RESOURCE_ORIGINS: process.env.NEXT_PUBLIC_MAP_RESOURCE_ORIGINS,
  };

  try {
    delete process.env.NEXT_PUBLIC_MAP_ENABLED;
    delete process.env.NEXT_PUBLIC_MAP_STYLE_URL;
    delete process.env.NEXT_PUBLIC_MAP_ATTRIBUTION;
    delete process.env.NEXT_PUBLIC_MAP_RESOURCE_ORIGINS;
    const disabled = buildContentSecurityPolicy("mapNonce", { isDevelopment: false });
    assert.doesNotMatch(disabled, /tiles\.example\.com/);

    process.env.NEXT_PUBLIC_MAP_ENABLED = "true";
    process.env.NEXT_PUBLIC_MAP_STYLE_URL = "https://styles.example.com/style.json";
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION = "Example attribution";
    process.env.NEXT_PUBLIC_MAP_RESOURCE_ORIGINS = "https://tiles.example.com https://glyphs.example.com/fonts";
    const enabled = buildContentSecurityPolicy("mapNonce", { isDevelopment: false });

    assert.match(enabled, /connect-src[^;]*https:\/\/styles\.example\.com/);
    assert.match(enabled, /connect-src[^;]*https:\/\/tiles\.example\.com/);
    assert.match(enabled, /img-src[^;]*https:\/\/tiles\.example\.com/);
    assert.match(enabled, /font-src[^;]*https:\/\/glyphs\.example\.com/);
    assert.doesNotMatch(enabled, /connect-src[^;]* \*/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
