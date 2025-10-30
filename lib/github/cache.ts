/**
 * GitHub API Response Cache
 * In-memory cache to reduce redundant API calls
 */

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
}

/**
 * Default cache settings
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
};

/**
 * Simple in-memory cache with TTL and size limits
 */
export class GitHubCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private accessOrder: string[] = [];

  constructor(
    private readonly config: CacheConfig = DEFAULT_CACHE_CONFIG
  ) {}

  /**
   * Generate cache key from parameters
   */
  private generateKey(prefix: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * Get cached value if available and not expired
   */
  get<T>(prefix: string, params: Record<string, unknown>): T | undefined {
    const key = this.generateKey(prefix, params);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      return undefined;
    }

    // Update access order (LRU)
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);

    return entry.data;
  }

  /**
   * Set cached value with expiration
   */
  set<T>(prefix: string, params: Record<string, unknown>, data: T, ttl?: number): void {
    const key = this.generateKey(prefix, params);
    const expiresAt = Date.now() + (ttl || this.config.ttl);

    this.cache.set(key, { data, expiresAt });
    this.accessOrder.push(key);

    // Enforce size limit (LRU eviction)
    while (this.cache.size > this.config.maxSize) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl,
    };
  }
}

/**
 * Cached execution wrapper
 * Automatically caches function results
 */
export async function withCache<T>(
  cache: GitHubCache,
  prefix: string,
  params: Record<string, unknown>,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Check cache first
  const cached = cache.get<T>(prefix, params);
  if (cached !== undefined) {
    return cached;
  }

  // Execute and cache
  const result = await fn();
  cache.set(prefix, params, result, ttl);
  return result;
}

/**
 * Global cache instance
 * Can be replaced with Redis or other cache in production
 */
export const globalCache = new GitHubCache();

