import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeSpacing,
  normalizeImportedLocation,
} from "../../src/lib/import-quality";

test("normalizeSpacing removes <script>...</script> fragments", () => {
  assert.equal(normalizeSpacing("</script><script>alert(1)</script>"), "alert(1)");
});

test("normalizeSpacing keeps legit make prefix when XSS is injected", () => {
  const input =
    "Dehler</script><script>fetch('/api/auth/session').then(r=>r.json()).then(d=>{var i=new Image();i.src='https://evil/xss';})</script>";
  assert.match(normalizeSpacing(input), /^Dehler\b/i);
});

test("normalizeSpacing drops javascript: URL schemes", () => {
  assert.doesNotMatch(normalizeSpacing("link javascript:alert(1)"), /javascript:/i);
});

test("normalizeSpacing leaves legitimate punctuation untouched", () => {
  assert.equal(normalizeSpacing("Fort Lauderdale, Florida"), "Fort Lauderdale, Florida");
});

test("normalizeImportedLocation strips HTML tags from a polluted location", () => {
  const result = normalizeImportedLocation("</script><script>alert(1)</script>");
  // Whatever textual residue survives (e.g. "alert(1)") is now inert — the
  // guarantee is that no HTML brackets or script-y URL schemes remain.
  assert.doesNotMatch(result, /[<>]/);
  assert.doesNotMatch(result, /javascript:/i);
});

test("normalizeImportedLocation keeps legit text when tags are mixed in", () => {
  const result = normalizeImportedLocation("Kiel, Germany<script>bad()</script>");
  assert.match(result, /Kiel/);
  assert.doesNotMatch(result, /[<>]/);
});
