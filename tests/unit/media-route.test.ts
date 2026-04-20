import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { GET } from "../../src/app/media/[...path]/route";
import { logger } from "../../src/lib/logger";

async function withLocalMediaEnv<T>(root: string, run: () => Promise<T>): Promise<T> {
  const previousBackend = process.env.MEDIA_BACKEND;
  const previousRoot = process.env.LOCAL_MEDIA_ROOT;
  process.env.MEDIA_BACKEND = "local";
  process.env.LOCAL_MEDIA_ROOT = root;

  try {
    return await run();
  } finally {
    if (previousBackend === undefined) {
      delete process.env.MEDIA_BACKEND;
    } else {
      process.env.MEDIA_BACKEND = previousBackend;
    }

    if (previousRoot === undefined) {
      delete process.env.LOCAL_MEDIA_ROOT;
    } else {
      process.env.LOCAL_MEDIA_ROOT = previousRoot;
    }
  }
}

async function withSilentLogger<T>(run: () => Promise<T>): Promise<T> {
  const previousLevel = logger.level;
  logger.level = "silent";

  try {
    return await run();
  } finally {
    logger.level = previousLevel;
  }
}

test("local media route serves files from the configured media root", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "onlyhulls-media-route-"));
  const filePath = path.join(root, "boats", "example", "images", "hero.txt");
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, "hello media", "utf8");

  const response = await withLocalMediaEnv(root, () =>
    GET(new Request("https://onlyhulls.test/media/boats/example/images/hero.txt"))
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(await response.text(), "hello media");
});

test("local media route rejects traversal attempts", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "onlyhulls-media-route-"));

  const response = await withSilentLogger(() =>
    withLocalMediaEnv(root, () =>
      GET(new Request("https://onlyhulls.test/media/..%2Fetc%2Fpasswd"))
    )
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Media not found" });
});
