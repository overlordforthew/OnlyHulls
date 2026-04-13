import Redis from "ioredis";

export function getRedisConnectionOptions(redisUrl = process.env.REDIS_URL || "") {
  const normalizedUrl = redisUrl.trim();

  if (!normalizedUrl) {
    return {
      host: "localhost",
      port: 6380,
      db: 0,
    };
  }

  const parsed = new URL(normalizedUrl);
  const dbFromPath = parsed.pathname.replace(/^\/+/, "");
  const db = Number.parseInt(dbFromPath || "0", 10);

  return {
    host: parsed.hostname || "localhost",
    port: parsed.port ? Number.parseInt(parsed.port, 10) : parsed.protocol === "rediss:" ? 6380 : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isNaN(db) ? 0 : db,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
  };
}

export const redis = new Redis({
  ...getRedisConnectionOptions(),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
