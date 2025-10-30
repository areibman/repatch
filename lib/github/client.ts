/**
 * GitHub API Client
 * Centralized Octokit client with authentication, rate limiting, and retry logic
 */

import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';

/**
 * Extended Octokit with plugins
 */
const OctokitWithPlugins = Octokit.plugin(retry, throttling);

/**
 * Singleton Octokit client instance
 */
let octokitInstance: Octokit | null = null;

/**
 * Get or create the Octokit client instance
 */
export function getOctokit(): Octokit {
  if (!octokitInstance) {
    const token = process.env.GITHUB_TOKEN;

    octokitInstance = new OctokitWithPlugins({
      auth: token,
      userAgent: 'Repatch-App',
      throttle: {
        onRateLimit: (retryAfter, options, octokit, retryCount) => {
          octokit.log.warn(
            `Request quota exhausted for request ${options.method} ${options.url}`
          );

          // Retry twice
          if (retryCount < 2) {
            octokit.log.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
          return false;
        },
        onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
          octokit.log.warn(
            `SecondaryRateLimit detected for request ${options.method} ${options.url}`
          );

          // Retry once
          if (retryCount < 1) {
            octokit.log.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
          return false;
        },
      },
      retry: {
        doNotRetry: [400, 401, 403, 404, 422],
      },
    });
  }

  return octokitInstance;
}

/**
 * Reset the Octokit instance (useful for testing)
 */
export function resetOctokit(): void {
  octokitInstance = null;
}

/**
 * Check if GitHub token is configured
 */
export function hasGitHubToken(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

/**
 * Get rate limit status
 */
export async function getRateLimit(): Promise<{
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.rateLimit.get();

  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    reset: new Date(data.rate.reset * 1000),
    used: data.rate.used,
  };
}

/**
 * Wait for rate limit reset if needed
 */
export async function waitForRateLimit(threshold = 10): Promise<void> {
  const rateLimit = await getRateLimit();

  if (rateLimit.remaining < threshold) {
    const now = Date.now();
    const resetTime = rateLimit.reset.getTime();
    const waitTime = Math.max(0, resetTime - now);

    if (waitTime > 0) {
      console.log(`Rate limit low (${rateLimit.remaining} remaining). Waiting ${Math.ceil(waitTime / 1000)}s until reset...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

