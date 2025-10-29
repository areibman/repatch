/**
 * GitHub API Client
 * Core client functionality with unified headers, rate limiting, and error handling
 */

import { GitHubError, createGitHubError, isRateLimitError } from './errors';

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Configuration for GitHub API client
 */
export interface GitHubClientConfig {
  readonly token?: string;
  readonly rateLimitRetryAfter?: number; // milliseconds to wait before retry
  readonly maxRetries?: number;
}

/**
 * GitHub API Client
 */
export class GitHubClient {
  private readonly config: Required<GitHubClientConfig>;

  constructor(config: GitHubClientConfig = {}) {
    this.config = {
      token: config.token || process.env.GITHUB_TOKEN || '',
      rateLimitRetryAfter: config.rateLimitRetryAfter ?? 60000, // 1 minute default
      maxRetries: config.maxRetries ?? 3,
    };
  }

  /**
   * Get headers for GitHub API requests
   */
  getHeaders(additionalHeaders?: HeadersInit): HeadersInit {
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
   * Parse rate limit information from response headers
   */
  parseRateLimit(response: Response): RateLimitInfo | null {
    const limit = response.headers.get('x-ratelimit-limit');
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');

    if (limit && remaining && reset) {
      return {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10) * 1000, // Convert to milliseconds
      };
    }

    return null;
  }

  /**
   * Wait for rate limit reset
   */
  private async waitForRateLimit(resetTime: number): Promise<void> {
    const now = Date.now();
    const waitTime = Math.max(0, resetTime - now) + 1000; // Add 1 second buffer

    if (waitTime > 0) {
      console.warn(
        `[GitHub Client] Rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Fetch with automatic retry on rate limit errors
   */
  async fetch(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<Response> {
    const headers = this.getHeaders(options.headers as HeadersInit);
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle rate limit errors with retry
    if (response.status === 403) {
      const rateLimit = this.parseRateLimit(response);
      const error = await createGitHubError(
        response,
        'GitHub API rate limit exceeded'
      );

      if (isRateLimitError(error) && rateLimit && retryCount < this.config.maxRetries) {
        await this.waitForRateLimit(rateLimit.reset);
        return this.fetch(url, options, retryCount + 1);
      }

      throw error;
    }

    // Handle other errors
    if (!response.ok) {
      throw await createGitHubError(
        response,
        `GitHub API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response;
  }
}

/**
 * Default GitHub client instance
 */
let defaultClient: GitHubClient | null = null;

/**
 * Get or create the default GitHub client
 */
export function getGitHubClient(): GitHubClient {
  if (!defaultClient) {
    defaultClient = new GitHubClient();
  }
  return defaultClient;
}
