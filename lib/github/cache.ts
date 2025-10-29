/**
 * GitHub API Cache Layer
 * Simple in-memory cache with TTL for expensive GitHub API calls
 * 
 * Note: For production distributed systems, consider using Redis or similar
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class GitHubCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Default TTL in milliseconds
   */
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached value if still valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set cache value with TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Clear specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Generate cache key from parameters
   */
  static createKey(prefix: string, ...params: (string | number | undefined)[]): string {
    return `${prefix}:${params.filter(Boolean).join(':')}`;
  }
}

const cache = new GitHubCache();

/**
 * Get or set cached value for a GitHub API call
 */
export async function cachedGitHubRequest<T>(
  cacheKey: string,
  requestFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try cache first
  const cached = cache.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Make request
  const data = await requestFn();

  // Cache result
  cache.set(cacheKey, data, ttl);

  return data;
}

/**
 * Create cache key helper
 */
export function createCacheKey(
  prefix: string,
  ...params: (string | number | undefined)[]
): string {
  return GitHubCache.createKey(prefix, ...params);
}

/**
 * Clear cache for a specific key pattern
 */
export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }

  // Simple pattern matching - for production, consider more sophisticated matching
  const keys = Array.from((cache as any).cache.keys());
  keys.forEach((key: string) => {
    if (key.startsWith(pattern)) {
      cache.delete(key);
    }
  });
}

/**
 * Cache configuration
 */
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,      // 1 minute
  MEDIUM: 5 * 60 * 1000,     // 5 minutes (default)
  LONG: 15 * 60 * 1000,      // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
} as const;
