/**
 * GitHub API Error Handling
 * Consistent error handling and rate limit management
 */

/**
 * Custom error class for GitHub API errors
 */
export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends GitHubApiError {
  constructor(
    message: string,
    public readonly resetAt?: Date
  ) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

/**
 * Parse error from GitHub API response
 */
export async function parseGitHubError(response: Response): Promise<GitHubApiError> {
  let message = `GitHub API error: ${response.status} ${response.statusText}`;
  
  try {
    const error = await response.json();
    if (error.message) {
      message = error.message;
    }
  } catch {
    // Use default message if JSON parsing fails
  }

  if (response.status === 429) {
    const resetHeader = response.headers.get('X-RateLimit-Reset');
    const resetAt = resetHeader ? new Date(parseInt(resetHeader) * 1000) : undefined;
    return new RateLimitError(message, resetAt);
  }

  return new GitHubApiError(message, response.status);
}

/**
 * Handle Octokit errors and convert to our error types
 */
export function handleOctokitError(error: unknown): GitHubApiError {
  if (error instanceof GitHubApiError) {
    return error;
  }

  if (error instanceof Error) {
    // Check if it's an Octokit error with status
    const octokitError = error as Error & { status?: number; response?: unknown };
    
    if (octokitError.status === 429) {
      return new RateLimitError(octokitError.message);
    }

    return new GitHubApiError(
      octokitError.message,
      octokitError.status,
      octokitError.response
    );
  }

  return new GitHubApiError('An unknown error occurred');
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on rate limit errors
      if (error instanceof RateLimitError) {
        throw error;
      }

      // Don't retry on client errors (4xx except 429)
      const githubError = handleOctokitError(error);
      if (githubError.statusCode && githubError.statusCode >= 400 && githubError.statusCode < 500 && githubError.statusCode !== 429) {
        throw githubError;
      }

      // Last attempt - throw the error
      if (attempt === maxRetries) {
        throw handleOctokitError(error);
      }

      // Wait with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw handleOctokitError(lastError);
}

/**
 * Safe error handling wrapper that returns empty results instead of throwing
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  fallback: T,
  logError = true
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (logError) {
      console.error('[GitHub API]', error instanceof Error ? error.message : 'Unknown error');
    }
    return fallback;
  }
}

