import { redis } from "./redis";

/**
 * Sliding window rate limiter backed by Redis sorted sets.
 * Returns allowed: true or allowed: false with a retryAfter (seconds).
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSecs: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const windowMs = windowSecs * 1000;
  const redisKey = `rl:${key}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, now - windowMs);
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
    pipeline.zcard(redisKey);
    pipeline.expire(redisKey, windowSecs + 1);
    const results = await pipeline.exec();

    const count = (results?.[2]?.[1] as number) ?? 0;

    if (count > maxRequests) {
      const oldest = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
      const oldestTs = oldest.length > 1 ? parseInt(oldest[1]) : now;
      const retryAfter = Math.ceil((oldestTs + windowMs - now) / 1000);
      return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
    }

    return { allowed: true };
  } catch {
    // Fail open: if Redis is unavailable, don't block legitimate traffic
    return { allowed: true };
  }
}
