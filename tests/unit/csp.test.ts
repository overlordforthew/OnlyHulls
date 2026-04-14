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
