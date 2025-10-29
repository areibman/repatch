/**
 * GitHub API Error Handling
 * Consistent error types and handling across all GitHub API calls
 */

export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

/**
 * Create a GitHubError from a failed API response
 */
export async function createGitHubError(
  response: Response,
  defaultMessage: string
): Promise<GitHubError> {
  let errorMessage = defaultMessage;
  let errorData: unknown;

  try {
    errorData = await response.json();
    if (errorData && typeof errorData === 'object' && 'message' in errorData) {
      errorMessage = String(errorData.message);
    }
  } catch {
    errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
  }

  return new GitHubError(errorMessage, response.status, errorData);
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof GitHubError &&
    error.statusCode === 403 &&
    error.response &&
    typeof error.response === 'object' &&
    'message' in error.response &&
    String(error.response.message).toLowerCase().includes('rate limit')
  );
}
