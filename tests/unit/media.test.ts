import test from "node:test";
import assert from "node:assert/strict";

import { getGalleryHeroImageMode } from "../../src/lib/media";

test("gallery keeps local hero media on optimized fill rendering", () => {
  assert.equal(getGalleryHeroImageMode("/media/boats/lagoon.jpg"), "optimized-fill");
});

test("gallery renders remote broker hero images at natural size", () => {
  assert.equal(
    getGalleryHeroImageMode("https://cdnx.theyachtmarket.com/img/165472904/2/lagoon.jpg"),
    "natural-size"
  );
  assert.equal(
    getGalleryHeroImageMode("https://www.sailboatlistings.com/sailimg/m/82124/main.jpg"),
    "natural-size"
  );
});
