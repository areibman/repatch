/**
 * GitHub Labels API
 */

import { getGitHubClient } from './client';
import { paginate } from './pagination';

/**
 * Fetch labels from GitHub repository
 */
export async function fetchGitHubLabels(
  owner: string,
  repo: string
): Promise<string[]> {
  const client = getGitHubClient();
  const endpoint = `/repos/${owner}/${repo}/labels`;

  const labels = await paginate<{ name?: string }>(client, endpoint, {
    maxPages: 10,
    perPage: 100,
    maxItems: 1000,
  });

  const result: string[] = [];

  for (const label of labels) {
    if (label?.name) {
      result.push(label.name);
    }
  }

  return result;
}
