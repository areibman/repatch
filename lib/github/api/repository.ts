/**
 * GitHub Repository API
 * Functions for fetching repository metadata (branches, tags, releases, labels)
 */

import { getOctokit } from '../client';
import { handleOctokitError } from '../error';
import { globalCache, withCache } from '../cache';
import { fetchPaginated, DEFAULT_PAGINATION } from '../pagination';
import type { GitHubBranch, GitHubTag, GitHubRelease } from '../types';

/**
 * Fetch all branches from a repository with caching
 */
export async function fetchGitHubBranches(
  owner: string,
  repo: string,
  useCache = true
): Promise<GitHubBranch[]> {
  const fetchFn = async () => {
    try {
      const octokit = getOctokit();

      const branches = await fetchPaginated<{
        name: string;
        protected?: boolean;
      }>(
        async (page, perPage) => {
          const { data } = await octokit.rest.repos.listBranches({
            owner,
            repo,
            per_page: perPage,
            page,
          });
          return data;
        },
        { ...DEFAULT_PAGINATION, maxItems: 500 }
      );

      // Map to our interface and sort
      const mapped = branches.map(branch => ({
        name: branch.name,
        protected: branch.protected || false,
      }));

      // Sort: main/master first, then alphabetically
      return mapped.sort((a, b) => {
        if (a.name === 'main') return -1;
        if (b.name === 'main') return 1;
        if (a.name === 'master') return -1;
        if (b.name === 'master') return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      throw handleOctokitError(error);
    }
  };

  if (useCache) {
    return withCache(globalCache, 'branches', { owner, repo }, fetchFn);
  }

  return fetchFn();
}

/**
 * Fetch all tags from a repository with caching
 */
export async function fetchGitHubTags(
  owner: string,
  repo: string,
  useCache = true
): Promise<GitHubTag[]> {
  const fetchFn = async () => {
    try {
      const octokit = getOctokit();

      const tags = await fetchPaginated<{
        name: string;
        commit: { sha: string };
      }>(
        async (page, perPage) => {
          const { data } = await octokit.rest.repos.listTags({
            owner,
            repo,
            per_page: perPage,
            page,
          });
          return data;
        },
        { ...DEFAULT_PAGINATION, maxPages: 10 }
      );

      return tags.map(tag => ({
        name: tag.name,
        commitSha: tag.commit.sha,
      }));
    } catch (error) {
      throw handleOctokitError(error);
    }
  };

  if (useCache) {
    return withCache(globalCache, 'tags', { owner, repo }, fetchFn);
  }

  return fetchFn();
}

/**
 * Fetch all releases from a repository with caching
 */
export async function fetchGitHubReleases(
  owner: string,
  repo: string,
  useCache = true
): Promise<GitHubRelease[]> {
  const fetchFn = async () => {
    try {
      const octokit = getOctokit();

      const releases = await fetchPaginated<{
        id: number;
        tag_name: string;
        name: string | null;
        published_at: string | null;
        target_commitish: string;
      }>(
        async (page, perPage) => {
          const { data } = await octokit.rest.repos.listReleases({
            owner,
            repo,
            per_page: perPage,
            page,
          });
          return data;
        },
        { ...DEFAULT_PAGINATION, perPage: 50, maxPages: 10 }
      );

      return releases.map(release => ({
        id: release.id,
        tagName: release.tag_name,
        name: release.name,
        publishedAt: release.published_at,
        targetCommitish: release.target_commitish,
      }));
    } catch (error) {
      throw handleOctokitError(error);
    }
  };

  if (useCache) {
    return withCache(globalCache, 'releases', { owner, repo }, fetchFn);
  }

  return fetchFn();
}

/**
 * Fetch all labels from a repository with caching
 */
export async function fetchGitHubLabels(
  owner: string,
  repo: string,
  useCache = true
): Promise<string[]> {
  const fetchFn = async () => {
    try {
      const octokit = getOctokit();

      const labels = await fetchPaginated<{ name?: string }>(
        async (page, perPage) => {
          const { data } = await octokit.rest.issues.listLabelsForRepo({
            owner,
            repo,
            per_page: perPage,
            page,
          });
          return data;
        },
        { ...DEFAULT_PAGINATION, maxPages: 10 }
      );

      return labels
        .filter((label): label is { name: string } => !!label.name)
        .map(label => label.name);
    } catch (error) {
      throw handleOctokitError(error);
    }
  };

  if (useCache) {
    return withCache(globalCache, 'labels', { owner, repo }, fetchFn);
  }

  return fetchFn();
}

/**
 * Parse repository information from GitHub URL
 */
export function parseGitHubUrl(
  url: string
): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
    };
  }
  return null;
}

