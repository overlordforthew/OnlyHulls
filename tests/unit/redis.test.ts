import test from "node:test";
import assert from "node:assert/strict";

import { getRedisConnectionOptions } from "../../src/lib/redis";

test("getRedisConnectionOptions falls back to local development defaults", () => {
  assert.deepEqual(getRedisConnectionOptions(""), {
    host: "localhost",
    port: 6380,
    db: 0,
  });
});

test("getRedisConnectionOptions parses standard redis URLs without legacy url.parse", () => {
  assert.deepEqual(
    getRedisConnectionOptions("redis://app-user:secret@example.internal:6391/4"),
    {
      host: "example.internal",
      port: 6391,
      username: "app-user",
      password: "secret",
      db: 4,
      tls: undefined,
    }
  );
});

test("getRedisConnectionOptions enables TLS for rediss URLs", () => {
  assert.deepEqual(
    getRedisConnectionOptions("rediss://cache.internal"),
    {
      host: "cache.internal",
      port: 6380,
      username: undefined,
      password: undefined,
      db: 0,
      tls: {},
    }
  );
});
