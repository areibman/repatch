/**
 * GitHub Releases API
 */

import { getGitHubClient } from './client';
import { paginate } from './pagination';
import type { GitHubRelease } from './types';

/**
 * Fetch releases from GitHub repository
 */
export async function fetchGitHubReleases(
  owner: string,
  repo: string
): Promise<GitHubRelease[]> {
  const client = getGitHubClient();
  const endpoint = `/repos/${owner}/${repo}/releases`;

  const releases = await paginate<{
    id: number;
    tag_name: string;
    name: string | null;
    published_at: string;
    target_commitish: string;
  }>(client, endpoint, {
    maxPages: 10,
    perPage: 50,
    maxItems: 500,
  });

  return releases.map((release) => ({
    id: release.id,
    tagName: release.tag_name,
    name: release.name,
    publishedAt: release.published_at,
    targetCommitish: release.target_commitish,
  }));
}
