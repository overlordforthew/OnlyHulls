import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMapStylePingHeaders,
  resolveMapStylePingReferer,
} from "../../src/lib/locations/map-style-ping";

test("map style ping referer prefers explicit override", () => {
  const result = resolveMapStylePingReferer({
    MAP_STYLE_PING_REFERER: "https://www.onlyhulls.com/boats?view=map#ignored",
    NEXT_PUBLIC_APP_URL: "https://onlyhulls.com",
    NEXTAUTH_URL: "https://onlyhulls.com/auth",
  });

  assert.equal(result.source, "MAP_STYLE_PING_REFERER");
  assert.equal(result.referer, "https://www.onlyhulls.com/boats?view=map");
  assert.deepEqual(result.rejected, []);
});

test("map style ping referer adds boats path for app base URLs", () => {
  const result = resolveMapStylePingReferer({
    NEXT_PUBLIC_APP_URL: "https://onlyhulls.com",
  });

  assert.equal(result.source, "NEXT_PUBLIC_APP_URL");
  assert.equal(result.referer, "https://onlyhulls.com/boats");
});

test("map style ping referer rejects malformed unsafe and off-host values before fallback", () => {
  const result = resolveMapStylePingReferer({
    MAP_STYLE_PING_REFERER: "notaurl",
    NEXT_PUBLIC_APP_URL: "http://onlyhulls.com",
    NEXTAUTH_URL: "https://evil.example/boats",
  });

  assert.equal(result.source, "default");
  assert.equal(result.referer, "https://onlyhulls.com/boats");
  assert.deepEqual(
    result.rejected.map((item) => [item.source, item.reason]),
    [
      ["MAP_STYLE_PING_REFERER", "malformed"],
      ["NEXT_PUBLIC_APP_URL", "unsafe_protocol"],
      ["NEXTAUTH_URL", "off_host"],
    ]
  );
});

test("map style ping referer supports explicit extra allowed hosts", () => {
  const result = resolveMapStylePingReferer({
    MAP_STYLE_PING_ALLOWED_HOSTS: "staging.onlyhulls.com",
    MAP_STYLE_PING_REFERER: "https://staging.onlyhulls.com/boats",
  });

  assert.equal(result.source, "MAP_STYLE_PING_REFERER");
  assert.equal(result.referer, "https://staging.onlyhulls.com/boats");
});

test("map style ping headers include the resolved Referer", () => {
  const result = buildMapStylePingHeaders({
    NEXTAUTH_URL: "https://www.onlyhulls.com",
  });

  assert.equal(result.headers.accept, "application/json");
  assert.equal(result.headers.Referer, "https://www.onlyhulls.com/boats");
  assert.equal(result.resolution.source, "NEXTAUTH_URL");
});
