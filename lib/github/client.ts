/**
 * GitHub API Client
 * Core client for making authenticated GitHub API requests with rate limiting
 */

export interface GitHubApiError {
  message: string;
  status: number;
  statusText: string;
}

export class GitHubApiException extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    message: string
  ) {
    super(message);
    this.name = 'GitHubApiException';
  }
}

/**
 * Rate limit tracking (simple in-memory implementation)
 * In production, consider using Redis or similar for distributed systems
 */
interface RateLimitState {
  remaining: number;
  reset: number; // Unix timestamp in seconds
}

class RateLimitTracker {
  private state: RateLimitState | null = null;

  updateFromHeaders(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');

    if (remaining && reset) {
      this.state = {
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
      };
    }
  }

  shouldWait(): boolean {
    if (!this.state) return false;
    
    // If we're close to rate limit (within 10% of limit), wait
    if (this.state.remaining < 50) {
      const now = Math.floor(Date.now() / 1000);
      if (this.state.reset > now) {
        return true;
      }
    }
    return false;
  }

  getWaitTime(): number {
    if (!this.state) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, (this.state.reset - now) * 1000);
  }

  getRemaining(): number {
    return this.state?.remaining ?? 5000; // Assume authenticated rate limit
  }
}

const rateLimitTracker = new RateLimitTracker();

/**
 * Default headers for GitHub API requests
 */
function getDefaultHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Repatch-App',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Wait for rate limit reset if needed
 */
async function waitForRateLimit(): Promise<void> {
  if (rateLimitTracker.shouldWait()) {
    const waitTime = rateLimitTracker.getWaitTime();
    if (waitTime > 0) {
      console.warn(`[GitHub API] Rate limit approaching, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Parse error response from GitHub API
 */
async function parseErrorResponse(
  response: Response
): Promise<GitHubApiError> {
  let message = `GitHub API error: ${response.status} ${response.statusText}`;
  
  try {
    const error = await response.json();
    message = error.message || message;
  } catch {
    // Use default message if JSON parsing fails
  }

  return {
    message,
    status: response.status,
    statusText: response.statusText,
  };
}

/**
 * Configuration for GitHub API requests
 */
export interface GitHubRequestConfig {
  /**
   * Custom headers to merge with default headers
   */
  headers?: HeadersInit;
  
  /**
   * Whether to throw on error (default: true)
   * If false, returns null on error
   */
  throwOnError?: boolean;
  
  /**
   * Accept header for custom media types
   */
  accept?: string;
}

/**
 * Make a GitHub API request with rate limiting and error handling
 */
export async function githubRequest<T>(
  url: string,
  config: GitHubRequestConfig = {}
): Promise<T> {
  await waitForRateLimit();

  const headers = new Headers(getDefaultHeaders());
  
  if (config.accept) {
    headers.set('Accept', config.accept);
  }
  
  if (config.headers) {
    Object.entries(config.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        headers.delete(key);
        value.forEach((v) => headers.append(key, v));
      }
    });
  }

  const response = await fetch(url, { headers });

  // Update rate limit tracking
  rateLimitTracker.updateFromHeaders(response.headers);

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    
    if (config.throwOnError !== false) {
      throw new GitHubApiException(error.status, error.statusText, error.message);
    }
    
    return null as T;
  }

  // Handle different response types
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  
  return response.text() as Promise<T>;
}

/**
 * Get rate limit information
 */
export function getRateLimitInfo(): { remaining: number } {
  return {
    remaining: rateLimitTracker.getRemaining(),
  };
}
