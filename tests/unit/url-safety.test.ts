import test from "node:test";
import assert from "node:assert/strict";

import { getSafeExternalUrl, isSafeExternalUrl } from "../../src/lib/url-safety";

test("getSafeExternalUrl keeps valid http and https urls", () => {
  assert.equal(
    getSafeExternalUrl("https://example.com/boats/1?ref=onlyhulls"),
    "https://example.com/boats/1?ref=onlyhulls"
  );
  assert.equal(
    getSafeExternalUrl("http://example.com/listing"),
    "http://example.com/listing"
  );
});

test("getSafeExternalUrl rejects non-http protocols and malformed values", () => {
  assert.equal(getSafeExternalUrl("javascript:alert(1)"), null);
  assert.equal(getSafeExternalUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(getSafeExternalUrl("ftp://example.com/boat"), null);
  assert.equal(getSafeExternalUrl("/boats/relative-path"), null);
  assert.equal(getSafeExternalUrl("not a url"), null);
  assert.equal(getSafeExternalUrl(""), null);
  assert.equal(getSafeExternalUrl(null), null);
  assert.equal(getSafeExternalUrl(undefined), null);
});

test("isSafeExternalUrl matches the sanitized result", () => {
  assert.equal(isSafeExternalUrl("https://onlyhulls.com/boats"), true);
  assert.equal(isSafeExternalUrl("javascript:alert(1)"), false);
});
