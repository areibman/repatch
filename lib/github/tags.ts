/**
 * GitHub Tags API
 */

import { getGitHubClient } from './client';
import { paginate } from './pagination';
import type { GitHubTag } from './types';

/**
 * Fetch tags from GitHub repository
 */
export async function fetchGitHubTags(
  owner: string,
  repo: string
): Promise<GitHubTag[]> {
  const client = getGitHubClient();
  const endpoint = `/repos/${owner}/${repo}/tags`;

  const tags = await paginate<{ name?: string; commit?: { sha?: string } }>(
    client,
    endpoint,
    {
      maxPages: 10,
      perPage: 100,
      maxItems: 1000,
    }
  );

  const result: GitHubTag[] = [];

  for (const tag of tags) {
    if (tag?.name && tag?.commit?.sha) {
      result.push({
        name: tag.name,
        commitSha: tag.commit.sha,
      });
    }
  }

  return result;
}
