/**
 * GitHub Repository Data Fetchers
 * Functions for fetching branches, tags, releases, and labels
 */

import { getGitHubClient } from './client';
import { fetchPaginated } from './pagination';
import { cached, getGitHubCache } from './cache';

export interface GitHubBranch {
  readonly name: string;
  readonly protected: boolean;
}

export interface GitHubTag {
  readonly name: string;
  readonly commitSha: string;
}

export interface GitHubRelease {
  readonly id: number;
  readonly tagName: string;
  readonly name: string | null;
  readonly publishedAt: string | null;
  readonly targetCommitish: string;
}

/**
 * Fetch branches from GitHub repository
 */
async function _fetchGitHubBranches(
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  const client = getGitHubClient();
  const url = `https://api.github.com/repos/${owner}/${repo}/branches`;

  const result = await fetchPaginated<{
    name: string;
    protected?: boolean;
  }>(client, url, {
    perPage: 100,
    maxPages: 10, // Limit to 1000 branches
    maxItems: 1000,
  });

  const branches = result.items.map((branch) => ({
    name: branch.name,
    protected: branch.protected || false,
  }));

  // Sort branches: main/master first, then alphabetically
  return branches.sort((a, b) => {
    if (a.name === 'main') return -1;
    if (b.name === 'main') return 1;
    if (a.name === 'master') return -1;
    if (b.name === 'master') return 1;
    return a.name.localeCompare(b.name);
  });
}

export const fetchGitHubBranches = cached(
  _fetchGitHubBranches,
  'branches',
  5 * 60 * 1000 // 5 minutes cache
);

/**
 * Fetch tags from GitHub repository
 */
async function _fetchGitHubTags(
  owner: string,
  repo: string
): Promise<GitHubTag[]> {
  const client = getGitHubClient();
  const url = `https://api.github.com/repos/${owner}/${repo}/tags`;

  const result = await fetchPaginated<{
    name?: string;
    commit?: { sha?: string };
  }>(client, url, {
    perPage: 100,
    maxPages: 10, // Limit to 1000 tags
    maxItems: 1000,
  });

  const tags: GitHubTag[] = [];

  for (const tag of result.items) {
    if (tag?.name && tag?.commit?.sha) {
      tags.push({
        name: tag.name,
        commitSha: tag.commit.sha,
      });
    }
  }

  return tags;
}

export const fetchGitHubTags = cached(
  _fetchGitHubTags,
  'tags',
  5 * 60 * 1000 // 5 minutes cache
);

/**
 * Fetch releases from GitHub repository
 */
async function _fetchGitHubReleases(
  owner: string,
  repo: string
): Promise<GitHubRelease[]> {
  const client = getGitHubClient();
  const url = `https://api.github.com/repos/${owner}/${repo}/releases`;

  const result = await fetchPaginated<{
    id: number;
    tag_name: string;
    name: string | null;
    published_at: string;
    target_commitish: string;
  }>(client, url, {
    perPage: 50,
    maxPages: 20, // Limit to 1000 releases
    maxItems: 1000,
  });

  return result.items.map((release) => ({
    id: release.id,
    tagName: release.tag_name,
    name: release.name,
    publishedAt: release.published_at,
    targetCommitish: release.target_commitish,
  }));
}

export const fetchGitHubReleases = cached(
  _fetchGitHubReleases,
  'releases',
  5 * 60 * 1000 // 5 minutes cache
);

/**
 * Fetch labels from GitHub repository
 */
async function _fetchGitHubLabels(
  owner: string,
  repo: string
): Promise<string[]> {
  const client = getGitHubClient();
  const url = `https://api.github.com/repos/${owner}/${repo}/labels`;

  const result = await fetchPaginated<{ name?: string }>(
    client,
    url,
    {
      perPage: 100,
      maxPages: 10, // Limit to 1000 labels
      maxItems: 1000,
    }
  );

  const labels: string[] = [];

  for (const label of result.items) {
    if (label?.name) {
      labels.push(label.name);
    }
  }

  return labels;
}

export const fetchGitHubLabels = cached(
  _fetchGitHubLabels,
  'labels',
  5 * 60 * 1000 // 5 minutes cache
);
