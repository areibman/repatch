/**
 * GitHub API Caching Layer
 * In-memory cache for expensive GitHub API calls
 */

interface CacheEntry<T> {
  readonly data: T;
  readonly expiresAt: number;
}

/**
 * Simple in-memory cache with TTL
 */
export class GitHubCache {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtl: number;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    // Default 5 minutes
    this.defaultTtl = defaultTtlMs;
  }

  /**
   * Generate cache key from parameters
   */
  private getKey(prefix: string, ...args: unknown[]): string {
    return `${prefix}:${JSON.stringify(args)}`;
  }

  /**
   * Get cached value if still valid
   */
  get<T>(prefix: string, ...args: unknown[]): T | null {
    const key = this.getKey(prefix, ...args);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached value with TTL
   */
  set<T>(prefix: string, data: T, ttlMs?: number, ...args: unknown[]): void {
    const key = this.getKey(prefix, ...args);
    const ttl = ttlMs ?? this.defaultTtl;

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Default cache instance
 */
let defaultCache: GitHubCache | null = null;

/**
 * Get or create the default cache instance
 */
export function getGitHubCache(): GitHubCache {
  if (!defaultCache) {
    defaultCache = new GitHubCache();
  }
  return defaultCache;
}

/**
 * Cache decorator for async functions
 */
export function cached<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  prefix: string,
  ttlMs?: number
): (...args: T) => Promise<R> {
  const cache = getGitHubCache();

  return async (...args: T): Promise<R> => {
    const cached = cache.get<R>(prefix, ...args);
    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    cache.set(prefix, result, ttlMs, ...args);
    return result;
  };
}
