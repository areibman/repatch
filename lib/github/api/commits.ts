/**
 * GitHub Commits API
 * Functions for fetching commit data and statistics
 */

import { getOctokit } from '../client';
import { handleOctokitError, safeExecute } from '../error';
import type { GitHubCommit, CommitStats, DateRange, TimePreset } from '../types';

/**
 * Calculate date range based on time period preset
 */
export function getDateRange(timePeriod: TimePreset): DateRange {
  const now = new Date();
  const until = now.toISOString();

  const since = new Date(now);
  switch (timePeriod) {
    case '1day':
      since.setDate(since.getDate() - 1);
      break;
    case '1week':
      since.setDate(since.getDate() - 7);
      break;
    case '1month':
      since.setMonth(since.getMonth() - 1);
      break;
  }

  return { since: since.toISOString(), until };
}

/**
 * Fetch commits from GitHub API for a time period and specific branch
 */
export async function fetchGitHubCommits(
  owner: string,
  repo: string,
  since: string,
  until: string,
  branch?: string
): Promise<GitHubCommit[]> {
  try {
    const octokit = getOctokit();

    const params: {
      owner: string;
      repo: string;
      since: string;
      until: string;
      per_page: number;
      sha?: string;
    } = {
      owner,
      repo,
      since,
      until,
      per_page: 100,
    };

    // Add branch parameter if specified
    if (branch) {
      params.sha = branch;
    }

    const { data } = await octokit.rest.repos.listCommits(params);

    return data as GitHubCommit[];
  } catch (error) {
    throw handleOctokitError(error);
  }
}

/**
 * Fetch detailed commit stats including additions/deletions
 * Returns empty stats on failure instead of throwing
 */
export async function fetchCommitStats(
  owner: string,
  repo: string,
  sha: string
): Promise<CommitStats> {
  return safeExecute(
    async () => {
      const octokit = getOctokit();

      const { data } = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });

      return {
        additions: data.stats?.additions || 0,
        deletions: data.stats?.deletions || 0,
      };
    },
    { additions: 0, deletions: 0 },
    false // Don't log errors for missing stats
  );
}

/**
 * Fetch commit diff/patch for AI summarization
 */
export async function fetchCommitDiff(
  owner: string,
  repo: string,
  sha: string
): Promise<string> {
  return safeExecute(
    async () => {
      const octokit = getOctokit();

      const { data } = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: sha,
        mediaType: {
          format: 'diff',
        },
      });

      return data as unknown as string;
    },
    '',
    false // Don't log errors for missing diffs
  );
}

/**
 * Fetch commits between two Git references (tags, branches, SHAs)
 */
export async function fetchCommitsBetweenRefs(
  owner: string,
  repo: string,
  baseRef: string,
  headRef: string
): Promise<GitHubCommit[]> {
  try {
    const octokit = getOctokit();

    const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${baseRef}...${headRef}`,
    });

    return (data.commits || []) as GitHubCommit[];
  } catch (error) {
    throw handleOctokitError(error);
  }
}

/**
 * Fetch commits by tag
 */
export async function fetchCommitsByTag(
  owner: string,
  repo: string,
  tag: string
): Promise<GitHubCommit[]> {
  try {
    const octokit = getOctokit();

    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      sha: tag,
      per_page: 100,
    });

    return data as GitHubCommit[];
  } catch (error) {
    throw handleOctokitError(error);
  }
}

/**
 * Fetch labels associated with a commit (via pull requests)
 * Returns empty array on failure
 */
export async function fetchCommitLabels(
  owner: string,
  repo: string,
  sha: string
): Promise<string[]> {
  return safeExecute(
    async () => {
      const octokit = getOctokit();

      const { data } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: sha,
      });

      const labelSet = new Set<string>();
      data.forEach(pull => {
        pull.labels?.forEach(label => {
          if (label.name) {
            labelSet.add(label.name);
          }
        });
      });

      return Array.from(labelSet);
    },
    [],
    false // Don't log errors for missing labels
  );
}

