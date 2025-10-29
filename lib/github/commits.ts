/**
 * GitHub Commit Operations
 * Functions for fetching commits, stats, diffs, and related data
 */

import { githubRequest } from './client';
import { paginateGitHubApi } from './pagination';
import { cachedGitHubRequest, createCacheKey, CACHE_TTL } from './cache';

/**
 * GitHub commit
 */
export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
  } | null;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

/**
 * Commit statistics
 */
export interface CommitStats {
  additions: number;
  deletions: number;
}

/**
 * Pull request details
 */
export interface PullRequestDetails {
  title: string;
  body: string | null;
  comments: Array<{ author: string; body: string }>;
  issueNumber?: number;
  issueTitle?: string;
  issueBody?: string | null;
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
  const url = new URL(
    `https://api.github.com/repos/${owner}/${repo}/commits`
  );
  url.searchParams.set('since', since);
  url.searchParams.set('until', until);
  url.searchParams.set('per_page', '100');
  
  if (branch) {
    url.searchParams.set('sha', branch);
  }

  return paginateGitHubApi<GitHubCommit>(url.toString(), {
    maxPages: 35, // GitHub API limit is typically 35 pages for commits
    perPage: 100,
  });
}

/**
 * Fetch detailed commit stats including additions/deletions
 */
export async function fetchCommitStats(
  owner: string,
  repo: string,
  sha: string
): Promise<CommitStats> {
  const cacheKey = createCacheKey('commit-stats', owner, repo, sha);
  
  return cachedGitHubRequest(
    cacheKey,
    async () => {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;
      
      try {
        const data = await githubRequest<{
          stats?: { additions?: number; deletions?: number };
        }>(url);
        
        return {
          additions: data?.stats?.additions ?? 0,
          deletions: data?.stats?.deletions ?? 0,
        };
      } catch {
        // Return zeros on error instead of throwing
        return { additions: 0, deletions: 0 };
      }
    },
    CACHE_TTL.LONG // Commit stats don't change
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
  const cacheKey = createCacheKey('commit-diff', owner, repo, sha);
  
  return cachedGitHubRequest(
    cacheKey,
    async () => {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;
      
      try {
        return await githubRequest<string>(url, {
          accept: 'application/vnd.github.v3.diff',
          throwOnError: false,
        });
      } catch {
        return '';
      }
    },
    CACHE_TTL.LONG // Diffs don't change
  );
}

/**
 * Fetch pull request details
 */
export async function fetchPullRequestDetails(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PullRequestDetails | null> {
  const cacheKey = createCacheKey('pr-details', owner, repo, prNumber);
  
  return cachedGitHubRequest(
    cacheKey,
    async () => {
      try {
        // Fetch PR details
        const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
        const prData = await githubRequest<{
          title: string;
          body: string | null;
        }>(prUrl, { throwOnError: false });

        if (!prData) {
          return null;
        }

        // Fetch PR comments
        const commentsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
        const commentsData = await githubRequest<
          Array<{ user?: { login?: string }; body?: string }>
        >(commentsUrl, { throwOnError: false });

        const comments = (commentsData || []).map((comment) => ({
          author: comment.user?.login || 'unknown',
          body: comment.body || '',
        }));

        // Extract linked issue from PR body if present
        let issueNumber: number | undefined;
        let issueTitle: string | undefined;
        let issueBody: string | null = null;

        const issueMatch = prData.body?.match(/#(\d+)|closes #(\d+)|fixes #(\d+)/i);
        if (issueMatch) {
          issueNumber = parseInt(
            issueMatch[1] || issueMatch[2] || issueMatch[3],
            10
          );

          // Fetch the linked issue
          const issueUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
          const issueData = await githubRequest<{
            title: string;
            body: string | null;
          }>(issueUrl, { throwOnError: false });

          if (issueData) {
            issueTitle = issueData.title;
            issueBody = issueData.body;
          }
        }

        return {
          title: prData.title,
          body: prData.body,
          comments,
          issueNumber,
          issueTitle,
          issueBody,
        };
      } catch {
        return null;
      }
    },
    CACHE_TTL.MEDIUM
  );
}

/**
 * Fetch commits between two references
 */
export async function fetchCommitsBetweenRefs(
  owner: string,
  repo: string,
  baseRef: string,
  headRef: string
): Promise<GitHubCommit[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/compare/${baseRef}...${headRef}`;
  
  try {
    const data = await githubRequest<{ commits?: GitHubCommit[] }>(url);
    return Array.isArray(data?.commits) ? data.commits : [];
  } catch {
    return [];
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
  const url = new URL(
    `https://api.github.com/repos/${owner}/${repo}/commits`
  );
  url.searchParams.set('sha', tag);
  url.searchParams.set('per_page', '100');

  return paginateGitHubApi<GitHubCommit>(url.toString(), {
    maxPages: 35,
    perPage: 100,
  });
}

/**
 * Fetch commit labels (from associated pull requests)
 */
export async function fetchCommitLabels(
  owner: string,
  repo: string,
  sha: string
): Promise<string[]> {
  const cacheKey = createCacheKey('commit-labels', owner, repo, sha);
  
  return cachedGitHubRequest(
    cacheKey,
    async () => {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/pulls`;
      
      try {
        const data = await githubRequest<
          Array<{ labels?: Array<{ name?: string }> }>
        >(url, {
          accept: 'application/vnd.github.groot-preview+json',
          throwOnError: false,
        });

        if (!Array.isArray(data)) {
          return [];
        }

        const labelSet = new Set<string>();
        data.forEach((pull) => {
          if (Array.isArray(pull?.labels)) {
            pull.labels.forEach((label) => {
              if (label?.name) {
                labelSet.add(label.name);
              }
            });
          }
        });

        return Array.from(labelSet);
      } catch {
        return [];
      }
    },
    CACHE_TTL.MEDIUM
  );
}
