/**
 * GitHub Branches API
 */

import { getGitHubClient } from './client';
import { paginate } from './pagination';
import { sortBranches } from './utils';
import type { GitHubBranch } from './types';

/**
 * Fetch branches from GitHub repository with pagination support
 */
export async function fetchGitHubBranches(
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  const client = getGitHubClient();
  const endpoint = `/repos/${owner}/${repo}/branches`;

  const branches = await paginate<{ name: string; protected?: boolean }>(
    client,
    endpoint,
    {
      maxPages: 5, // Safety limit: 500 branches max
      perPage: 100,
      maxItems: 500,
    }
  );

  const result: GitHubBranch[] = branches.map((branch) => ({
    name: branch.name,
    protected: branch.protected || false,
  }));

  return sortBranches(result);
}
