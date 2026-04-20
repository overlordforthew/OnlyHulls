import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveLocalMediaPath } from "../../src/lib/storage-local";

test("local media resolver keeps normalized keys inside the configured root", () => {
  const previousRoot = process.env.LOCAL_MEDIA_ROOT;
  const root = mkdtempSync(path.join(tmpdir(), "onlyhulls-media-"));
  process.env.LOCAL_MEDIA_ROOT = root;

  try {
    assert.equal(
      resolveLocalMediaPath("/boats/example/images/hero.jpg"),
      path.join(root, "boats", "example", "images", "hero.jpg")
    );
    assert.equal(
      resolveLocalMediaPath("boats\\example\\images\\hero.jpg"),
      path.join(root, "boats", "example", "images", "hero.jpg")
    );
  } finally {
    if (previousRoot === undefined) {
      delete process.env.LOCAL_MEDIA_ROOT;
    } else {
      process.env.LOCAL_MEDIA_ROOT = previousRoot;
    }
  }
});

test("local media resolver rejects empty, dot, and traversal keys", () => {
  const previousRoot = process.env.LOCAL_MEDIA_ROOT;
  const root = mkdtempSync(path.join(tmpdir(), "onlyhulls-media-"));
  process.env.LOCAL_MEDIA_ROOT = root;

  try {
    for (const key of ["", ".", "boats/../private.jpg", "../private.jpg", "/../private.jpg"]) {
      assert.throws(() => resolveLocalMediaPath(key), /Invalid media path/);
    }
  } finally {
    if (previousRoot === undefined) {
      delete process.env.LOCAL_MEDIA_ROOT;
    } else {
      process.env.LOCAL_MEDIA_ROOT = previousRoot;
    }
  }
});
