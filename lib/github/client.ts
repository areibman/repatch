/**
 * GitHub API Client
 * Handles HTTP requests, rate limiting, retries, and caching
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface RateLimitInfo {
  remaining: number;
  reset: number;
}

/**
 * Configuration for GitHub API client
 */
export interface GitHubClientConfig {
  readonly baseUrl?: string;
  readonly token?: string;
  readonly cacheTTL?: number; // Cache TTL in milliseconds
  readonly maxRetries?: number;
  readonly retryDelay?: number; // Initial retry delay in milliseconds
  readonly maxPageLimit?: number; // Maximum pages to fetch per request
  readonly perPageLimit?: number; // Items per page
}

const DEFAULT_CONFIG: Required<GitHubClientConfig> = {
  baseUrl: 'https://api.github.com',
  token: process.env.GITHUB_TOKEN,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  maxPageLimit: 10,
  perPageLimit: 100,
};

/**
 * In-memory cache for API responses
 */
class GitHubCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
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

  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Clear expired entries (call periodically)
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Rate limit tracking
 */
class RateLimitTracker {
  private rateLimits = new Map<string, RateLimitInfo>();

  update(endpoint: string, remaining: number, reset: number): void {
    this.rateLimits.set(endpoint, { remaining, reset });
  }

  getRemaining(endpoint: string): number {
    const info = this.rateLimits.get(endpoint);
    return info?.remaining ?? 5000; // Default to authenticated limit
  }

  getResetTime(endpoint: string): number {
    const info = this.rateLimits.get(endpoint);
    return info?.reset ?? Date.now() + 3600000; // Default to 1 hour
  }

  shouldWait(endpoint: string): boolean {
    const remaining = this.getRemaining(endpoint);
    return remaining < 10; // Wait if less than 10 requests remaining
  }

  getWaitTime(endpoint: string): number {
    const reset = this.getResetTime(endpoint);
    const waitTime = reset - Date.now();
    return Math.max(0, waitTime);
  }
}

/**
 * GitHub API Client
 */
export class GitHubClient {
  private config: Required<GitHubClientConfig>;
  private cache: GitHubCache;
  private rateLimitTracker: RateLimitTracker;

  constructor(config: GitHubClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new GitHubCache();
    this.rateLimitTracker = new RateLimitTracker();

    // Cleanup cache every 10 minutes
    setInterval(() => this.cache.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Get headers for GitHub API requests
   */
  private getHeaders(additionalHeaders?: HeadersInit): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Repatch-App',
      ...additionalHeaders,
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    return headers;
  }

  /**
   * Parse rate limit headers from response
   */
  private parseRateLimitHeaders(response: Response, endpoint: string): void {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');

    if (remaining && reset) {
      this.rateLimitTracker.update(
        endpoint,
        parseInt(remaining, 10),
        parseInt(reset, 10) * 1000 // Convert to milliseconds
      );
    }
  }

  /**
   * Handle rate limit errors
   */
  private async handleRateLimit(endpoint: string): Promise<void> {
    const waitTime = this.rateLimitTracker.getWaitTime(endpoint);
    if (waitTime > 0) {
      console.warn(
        `[GitHub Client] Rate limit reached for ${endpoint}. Waiting ${Math.ceil(waitTime / 1000)}s`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Create consistent error from response
   */
  private async createError(
    response: Response,
    endpoint: string
  ): Promise<Error> {
    let errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;

    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      // Use default error message
    }

    // Add rate limit context
    if (response.status === 403) {
      const waitTime = this.rateLimitTracker.getWaitTime(endpoint);
      errorMessage += `. Rate limit resets in ${Math.ceil(waitTime / 1000)}s`;
    }

    return new Error(errorMessage);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request with retry logic and rate limit handling
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useCache = true
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const cacheKey = useCache ? `${options.method || 'GET'}:${url}` : null;

    // Check cache
    if (cacheKey) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Check rate limits before making request
    if (this.rateLimitTracker.shouldWait(endpoint)) {
      await this.handleRateLimit(endpoint);
    }

    const headers = this.getHeaders(options.headers as HeadersInit);
    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        // Parse rate limit headers
        this.parseRateLimitHeaders(response, endpoint);

        // Handle rate limit (403)
        if (response.status === 403) {
          await this.handleRateLimit(endpoint);
          // Retry after waiting
          continue;
        }

        // Handle other errors
        if (!response.ok) {
          const error = await this.createError(response, endpoint);
          // Don't retry on 4xx errors (except rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 403) {
            throw error;
          }
          lastError = error;
          // Wait before retry
          if (attempt < this.config.maxRetries) {
            await this.sleep(this.config.retryDelay * (attempt + 1));
          }
          continue;
        }

        const data = await response.json();

        // Cache successful responses
        if (cacheKey) {
          this.cache.set(cacheKey, data, this.config.cacheTTL);
        }

        return data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.config.maxRetries) {
          await this.sleep(this.config.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError || new Error(`Failed to fetch ${endpoint} after ${this.config.maxRetries} retries`);
  }

  /**
   * Fetch raw text response (for diffs, etc.)
   */
  async requestText(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<string> {
    const url = `${this.config.baseUrl}${endpoint}`;

    // Check rate limits
    if (this.rateLimitTracker.shouldWait(endpoint)) {
      await this.handleRateLimit(endpoint);
    }

    const headers = this.getHeaders(options.headers as HeadersInit);

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        this.parseRateLimitHeaders(response, endpoint);

        if (response.status === 403) {
          await this.handleRateLimit(endpoint);
          continue;
        }

        if (!response.ok) {
          const error = await this.createError(response, endpoint);
          if (response.status >= 400 && response.status < 500 && response.status !== 403) {
            throw error;
          }
          if (attempt < this.config.maxRetries) {
            await this.sleep(this.config.retryDelay * (attempt + 1));
          }
          continue;
        }

        return await response.text();
      } catch (error) {
        if (attempt < this.config.maxRetries) {
          await this.sleep(this.config.retryDelay * (attempt + 1));
        } else {
          throw error instanceof Error ? error : new Error(String(error));
        }
      }
    }

    throw new Error(`Failed to fetch ${endpoint} after ${this.config.maxRetries} retries`);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<GitHubClientConfig>> {
    return this.config;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Default GitHub client instance
 */
let defaultClient: GitHubClient | null = null;

/**
 * Get or create default GitHub client
 */
export function getGitHubClient(config?: GitHubClientConfig): GitHubClient {
  if (!defaultClient) {
    defaultClient = new GitHubClient(config);
  }
  return defaultClient;
}
