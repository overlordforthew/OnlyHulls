import test from "node:test";
import assert from "node:assert/strict";

import { classifyExternalImageFetch } from "../../src/lib/media-health";

test("external image health accepts non-empty image responses", () => {
  assert.deepEqual(
    classifyExternalImageFetch({
      httpStatus: 206,
      contentType: "image/jpeg",
      byteLength: 4096,
    }),
    {
      fetchStatus: "ok",
      blockedReason: null,
    }
  );
});

test("external image health rejects empty image bodies", () => {
  assert.deepEqual(
    classifyExternalImageFetch({
      httpStatus: 200,
      contentType: "image/jpeg",
      byteLength: 0,
    }),
    {
      fetchStatus: "failed",
      blockedReason: "empty_body",
    }
  );
});

test("external image health rejects HTML and HTTP failures", () => {
  assert.deepEqual(
    classifyExternalImageFetch({
      httpStatus: 200,
      contentType: "text/html",
      byteLength: 2048,
    }),
    {
      fetchStatus: "failed",
      blockedReason: "non_image_content_type",
    }
  );

  assert.deepEqual(
    classifyExternalImageFetch({
      httpStatus: 404,
      contentType: "image/jpeg",
      byteLength: 2048,
    }),
    {
      fetchStatus: "failed",
      blockedReason: "http_404",
    }
  );
});
