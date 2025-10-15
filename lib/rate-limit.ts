export type RateLimitOptions = {
  windowMs: number;
  limit: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset: number;
};

type Counter = {
  count: number;
  windowStart: number;
};

const globalStore = globalThis as typeof globalThis & {
  __externalApiRateLimitStore?: Map<string, Counter>;
};

const store =
  globalStore.__externalApiRateLimitStore ??
  (globalStore.__externalApiRateLimitStore = new Map<string, Counter>());

export function getRateLimitOptions(): RateLimitOptions {
  const limit = Number(process.env.EXTERNAL_API_RATE_LIMIT ?? '60');
  const windowMs = Number(process.env.EXTERNAL_API_RATE_WINDOW_MS ?? '60000');

  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : 60,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60000,
  };
}

export function resetRateLimits() {
  store.clear();
}

export function checkRateLimit(key: string): RateLimitResult {
  const { limit, windowMs } = getRateLimitOptions();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      limit,
      reset: now + windowMs,
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      reset: entry.windowStart + windowMs,
    };
  }

  entry.count += 1;
  store.set(key, entry);

  return {
    allowed: true,
    remaining: Math.max(limit - entry.count, 0),
    limit,
    reset: entry.windowStart + windowMs,
  };
}
