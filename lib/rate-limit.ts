export type RateLimitResult =
  | {
      ok: true;
      remaining: number;
      resetAt: number;
    }
  | {
      ok: false;
      retryAfter: number;
      resetAt: number;
    };

export class MemoryRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  take(key: string): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { ok: true, remaining: this.limit - 1, resetAt };
    }

    if (bucket.count >= this.limit) {
      return {
        ok: false,
        retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
        resetAt: bucket.resetAt,
      };
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);

    return {
      ok: true,
      remaining: this.limit - bucket.count,
      resetAt: bucket.resetAt,
    };
  }

  getLimit() {
    return this.limit;
  }
}
