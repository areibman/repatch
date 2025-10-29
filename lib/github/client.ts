/**
 * GitHub API Client
 * Core client with rate limiting, caching, and consistent error handling
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface RateLimitState {
  remaining: number;
  resetAt: number;
}

/**
 * In-memory cache with TTL
 */
class GitHubCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL: number;

  constructor(defaultTTLSeconds: number = 300) {
    this.defaultTTL = defaultTTLSeconds * 1000;
  }

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

  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds ?? this.defaultTTL / 1000) * 1000;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries periodically
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
 * Rate limit manager for GitHub API
 */
class RateLimitManager {
  private state: RateLimitState = {
    remaining: 5000, // Conservative default
    resetAt: Date.now() + 3600000, // 1 hour
  };

  /**
   * Parse rate limit headers from response
   */
  updateFromHeaders(headers: Headers): void {
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");

    if (remaining !== null) {
      this.state.remaining = parseInt(remaining, 10);
    }

    if (reset !== null) {
      const resetTimestamp = parseInt(reset, 10) * 1000;
      this.state.resetAt = resetTimestamp;
    }
  }

  /**
   * Check if we can make a request
   */
  canMakeRequest(): boolean {
    if (this.state.remaining <= 10) {
      // Buffer to avoid hitting limit
      const timeUntilReset = this.state.resetAt - Date.now();
      if (timeUntilReset > 0) {
        return false;
      }
      // Reset time has passed, assume limit refreshed
      this.state.remaining = 5000;
    }
    return true;
  }

  /**
   * Get time until rate limit resets (in ms)
   */
  getTimeUntilReset(): number {
    return Math.max(0, this.state.resetAt - Date.now());
  }

  /**
   * Get remaining requests
   */
  getRemaining(): number {
    return this.state.remaining;
  }
}

/**
 * GitHub API error
 */
export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

/**
 * GitHub API Client
 */
export class GitHubClient {
  private readonly cache: GitHubCache;
  private readonly rateLimit: RateLimitManager;
  private readonly baseURL = "https://api.github.com";

  constructor(cacheTTLSeconds: number = 300) {
    this.cache = new GitHubCache(cacheTTLSeconds);
    this.rateLimit = new RateLimitManager();

    // Cleanup cache every 5 minutes
    setInterval(() => this.cache.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get headers for GitHub API requests
   */
  private getHeaders(additionalHeaders?: HeadersInit): HeadersInit {
    const headers: HeadersInit = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Repatch-App",
      ...additionalHeaders,
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Wait until rate limit resets
   */
  private async waitForRateLimit(): Promise<void> {
    const waitTime = this.rateLimit.getTimeUntilReset();
    if (waitTime > 0) {
      console.warn(
        `[GitHub Client] Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime + 1000));
    }
  }

  /**
   * Parse error response
   */
  private async parseError(
    response: Response
  ): Promise<{ message: string; details?: unknown }> {
    let message = `GitHub API error: ${response.status} ${response.statusText}`;
    let details: unknown;

    try {
      const error = await response.json();
      if (error && typeof error === "object" && "message" in error) {
        message = String(error.message);
        details = error;
      }
    } catch {
      // Failed to parse JSON, use default message
    }

    return { message, details };
  }

  /**
   * Make a GitHub API request with rate limiting, caching, and error handling
   */
  async request<T>(
    endpoint: string,
    options: {
      method?: string;
      cacheKey?: string;
      cacheTTL?: number;
      skipCache?: boolean;
      headers?: HeadersInit;
      body?: unknown;
    } = {}
  ): Promise<T> {
    const {
      method = "GET",
      cacheKey,
      cacheTTL,
      skipCache = false,
      headers: additionalHeaders,
      body,
    } = options;

    // Check cache for GET requests
    if (method === "GET" && !skipCache && cacheKey) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Check rate limit
    if (!this.rateLimit.canMakeRequest()) {
      await this.waitForRateLimit();
    }

    const url = `${this.baseURL}${endpoint}`;
    const requestHeaders = this.getHeaders(additionalHeaders);

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body) {
      requestInit.body = JSON.stringify(body);
      requestHeaders["Content-Type"] = "application/json";
    }

    const response = await fetch(url, requestInit);

    // Update rate limit state
    this.rateLimit.updateFromHeaders(response.headers);

    // Handle rate limit error
    if (response.status === 403) {
      const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
      if (rateLimitRemaining === "0") {
        await this.waitForRateLimit();
        // Retry once after waiting
        const retryResponse = await fetch(url, requestInit);
        this.rateLimit.updateFromHeaders(retryResponse.headers);

        if (!retryResponse.ok) {
          const { message, details } = await this.parseError(retryResponse);
          throw new GitHubAPIError(
            message,
            retryResponse.status,
            retryResponse.statusText,
            details
          );
        }

        const data = await retryResponse.json();
        if (method === "GET" && cacheKey) {
          this.cache.set(cacheKey, data, cacheTTL);
        }
        return data as T;
      }
    }

    // Handle other errors
    if (!response.ok) {
      const { message, details } = await this.parseError(response);
      throw new GitHubAPIError(message, response.status, response.statusText, details);
    }

    const data = await response.json();

    // Cache successful GET responses
    if (method === "GET" && cacheKey) {
      this.cache.set(cacheKey, data, cacheTTL);
    }

    return data as T;
  }

  /**
   * Clear cache (useful for testing or manual invalidation)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { remaining: number; resetAt: number } {
    return {
      remaining: this.rateLimit.getRemaining(),
      resetAt: this.rateLimit.getTimeUntilReset(),
    };
  }
}

// Singleton instance
let clientInstance: GitHubClient | null = null;

/**
 * Get or create the GitHub client instance
 */
export function getGitHubClient(): GitHubClient {
  if (!clientInstance) {
    clientInstance = new GitHubClient();
  }
  return clientInstance;
}
