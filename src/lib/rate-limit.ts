import Redis from "ioredis";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };
export interface RateLimitProvider { consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>; }
export class MemoryRateLimitProvider implements RateLimitProvider {
  private entries = new Map<string, { count: number; resetAt: number }>();
  async consume(key: string, limit: number, windowSeconds: number) {
    const now = Date.now(); const current = this.entries.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowSeconds * 1000 } : current;
    entry.count += 1; this.entries.set(key, entry);
    return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count), retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
}
export class RedisRateLimitProvider implements RateLimitProvider {
  private redis: Redis;
  constructor(url: string) { this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false }); }
  async consume(key: string, limit: number, windowSeconds: number) {
    if (this.redis.status === "wait") await this.redis.connect();
    const count = await this.redis.incr(`rl:${key}`); if (count === 1) await this.redis.expire(`rl:${key}`, windowSeconds);
    const ttl = await this.redis.ttl(`rl:${key}`); return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds: Math.max(1, ttl) };
  }
}
let provider: RateLimitProvider | undefined;
export function rateLimitProvider(env = process.env) {
  if (!provider) {
    if (env.RATE_LIMIT_PROVIDER === "redis") {
      if (!env.REDIS_URL) throw new Error("Rate limit Redis não configurado.");
      provider = new RedisRateLimitProvider(env.REDIS_URL);
    } else {
      if (env.NODE_ENV === "production" && env.DEPLOYMENT_MODE !== "demo") throw new Error("Rate limit em memória é proibido no modo full de produção.");
      provider = new MemoryRateLimitProvider();
    }
  }
  return provider;
}
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  return rateLimitProvider().consume(key, limit, windowSeconds);
}
