/**
 * GitHub Repository Operations
 * Functions for fetching branches, tags, releases, and labels
 */

import { githubRequest } from './client';
import { paginateGitHubApi, PAGINATION_LIMITS } from './pagination';
import { cachedGitHubRequest, createCacheKey, CACHE_TTL } from './cache';

/**
 * GitHub branch
 */
export interface GitHubBranch {
  name: string;
  protected: boolean;
}

/**
 * GitHub tag
 */
export interface GitHubTag {
  name: string;
  commitSha: string;
}

/**
 * GitHub release
 */
export interface GitHubRelease {
  id: number;
  tagName: string;
  name: string | null;
  publishedAt: string | null;
  targetCommitish: string;
}

/**
 * Fetch branches from GitHub repository
 */
export async function fetchGitHubBranches(
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  const cacheKey = createCacheKey('branches', owner, repo);
  
  return cachedGitHubRequest(
    cacheKey,
    async () => {
      const url = `https://api.github.com/repos/${owner}/${repo}/branches`;
      
      const branches = await paginateGitHubApi<{
        name: string;
        protected?: boolean;
      }>(url, {
        maxItems: 500, // Reasonable limit for branches
        perPage: 100,
      });

      const result = branches.map((branch) => ({
        name: branch.name,
        protected: branch.protected || false,
      }));

      // Sort branches: main/master first, then alphabetically
      return result.sort((a, b) => {
        if (a.name === 'main') return -1;
        if (b.name === 'main') return 1;
        if (a.name === 'master') return -1;
        if (b.name === 'master') return 1;
        return a.name.localeCompare(b.name);
      });
    },
    CACHE_TTL.MEDIUM
  );
}

/**
 * Fetch tags from GitHub repository
 */
export async function fetchGitHubTags(
  owner: string,
  repo: string
): Promise<GitHubTag[]> {
  const cacheKey = createCacheKey('tags', owner, repo);
  
  return cachedGitHubRequest(
    cacheKey,
    async () => {
      const url = `https://api.github.com/repos/${owner}/${repo}/tags`;
      
      const tags = await paginateGitHubApi<{
        name?: string;
        commit?: { sha?: string };
      }>(url, {
        maxPages: 10, // Reasonable limit for tags
        perPage: 100,
      });

      return tags
        .filter((tag): tag is { name: string; commit: { sha: string } } => 
          Boolean(tag?.name && tag?.commit?.sha)
        )
        .map((tag) => ({
          name: tag.name,
          commitSha: tag.commit.sha,
        }));
    },
    CACHE_TTL.MEDIUM
  );
}

/**
 * Fetch releases from GitHub repository
 */
export async function fetchGitHubReleases(
  owner: string,
  repo: string
): Promise<GitHubRelease[]> {
  const cacheKey = createCacheKey('releases', owner, repo);
  
  return cachedGitHubRequest(
    cacheKey,
    async () => {
      const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
      
      const releases = await paginateGitHubApi<{
        id: number;
        tag_name: string;
        name: string | null;
        published_at: string | null;
        target_commitish: string;
      }>(url, {
        maxPages: 10, // Reasonable limit for releases
        perPage: 50,
      });

      return releases.map((release) => ({
        id: release.id,
        tagName: release.tag_name,
        name: release.name,
        publishedAt: release.published_at,
        targetCommitish: release.target_commitish,
      }));
    },
    CACHE_TTL.MEDIUM
  );
}

/**
 * Fetch labels from GitHub repository
 */
export async function fetchGitHubLabels(
  owner: string,
  repo: string
): Promise<string[]> {
  const cacheKey = createCacheKey('labels', owner, repo);
  
  return cachedGitHubRequest(
    cacheKey,
    async () => {
      const url = `https://api.github.com/repos/${owner}/${repo}/labels`;
      
      const labels = await paginateGitHubApi<{ name?: string }>(url, {
        maxPages: 10, // Reasonable limit for labels
        perPage: 100,
      });

      return labels
        .map((label) => label?.name)
        .filter((name): name is string => Boolean(name));
    },
    CACHE_TTL.MEDIUM
  );
}
