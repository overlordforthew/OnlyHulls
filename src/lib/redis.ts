import Redis from "ioredis";

function buildRedisOptions() {
  const redisUrl = (process.env.REDIS_URL || "").trim();

  if (!redisUrl) {
    return {
      host: "localhost",
      port: 6380,
      db: 0,
    };
  }

  const parsed = new URL(redisUrl);
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
  ...buildRedisOptions(),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
