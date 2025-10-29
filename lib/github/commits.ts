/**
 * GitHub Commit Diff and Details Fetchers
 * Functions for fetching commits, diffs, PR details, and labels
 */

import { getGitHubClient } from './client';
import { fetchSinglePage } from './pagination';
import type { PatchNoteFilters, TimePreset } from '../types/patch-note';
import { normalizeFilters } from '../filter-utils';
import { getDateRange } from './utils';
import { fetchGitHubTags } from './repositories';

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
 * Fetch commits from GitHub API for a time period and specific branch
 */
export async function fetchGitHubCommits(
  owner: string,
  repo: string,
  since: string,
  until: string,
  branch?: string
): Promise<GitHubCommit[]> {
  const client = getGitHubClient();
  let url = `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&until=${until}&per_page=100`;

  if (branch) {
    url += `&sha=${encodeURIComponent(branch)}`;
  }

  const response = await client.fetch(url);
  return response.json();
}

/**
 * Fetch detailed commit stats including additions/deletions
 */
export async function fetchCommitStats(
  owner: string,
  repo: string,
  sha: string
): Promise<{ additions: number; deletions: number }> {
  const client = getGitHubClient();
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;

  try {
    const response = await client.fetch(url);
    const data = await response.json();
    return {
      additions: data.stats?.additions || 0,
      deletions: data.stats?.deletions || 0,
    };
  } catch {
    // Return zeros on error instead of throwing
    return { additions: 0, deletions: 0 };
  }
}

/**
 * Fetch commit diff/patch for AI summarization
 */
export async function fetchCommitDiff(
  owner: string,
  repo: string,
  sha: string
): Promise<string> {
  const client = getGitHubClient();
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;

  try {
    const response = await client.fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3.diff',
      },
    });
    return response.text();
  } catch {
    // Return empty string on error instead of throwing
    return '';
  }
}

/**
 * Fetch pull request details
 */
export async function fetchPullRequestDetails(
  owner: string,
  repo: string,
  prNumber: number
): Promise<{
  title: string;
  body: string | null;
  comments: Array<{ author: string; body: string }>;
  issueNumber?: number;
  issueTitle?: string;
  issueBody?: string | null;
} | null> {
  const client = getGitHubClient();

  try {
    // Fetch PR details
    const prResponse = await client.fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`
    );

    if (!prResponse.ok) {
      return null;
    }

    const prData = await prResponse.json();

    // Fetch PR comments
    const commentsResponse = await client.fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`
    );

    let comments: Array<{ author: string; body: string }> = [];
    if (commentsResponse.ok) {
      const commentsData = await commentsResponse.json();
      comments = commentsData.map(
        (comment: { user?: { login?: string }; body?: string }) => ({
          author: comment.user?.login || 'unknown',
          body: comment.body || '',
        })
      );
    }

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
      const issueResponse = await client.fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`
      );

      if (issueResponse.ok) {
        const issueData = await issueResponse.json();
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
}

/**
 * Fetch commits between two references
 */
async function fetchCommitsBetweenRefs(
  owner: string,
  repo: string,
  baseRef: string,
  headRef: string
): Promise<GitHubCommit[]> {
  const client = getGitHubClient();
  const url = `https://api.github.com/repos/${owner}/${repo}/compare/${baseRef}...${headRef}`;

  const response = await client.fetch(url);
  const data = await response.json();

  if (Array.isArray(data?.commits)) {
    return data.commits as GitHubCommit[];
  }

  return [];
}

/**
 * Fetch commits by tag
 */
async function fetchCommitsByTag(
  owner: string,
  repo: string,
  tag: string
): Promise<GitHubCommit[]> {
  const client = getGitHubClient();
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(tag)}&per_page=100`;

  const response = await client.fetch(url);
  const data = await response.json();

  return Array.isArray(data) ? (data as GitHubCommit[]) : [];
}

/**
 * Collect commits for releases
 */
async function collectCommitsForReleases(
  owner: string,
  repo: string,
  releases: NonNullable<PatchNoteFilters['releases']>
): Promise<GitHubCommit[]> {
  const commitsBySha = new Map<string, GitHubCommit>();

  for (const release of releases) {
    if (!release?.tag) continue;

    try {
      let releaseCommits: GitHubCommit[] = [];
      if (release.previousTag) {
        releaseCommits = await fetchCommitsBetweenRefs(
          owner,
          repo,
          release.previousTag,
          release.tag
        );
      } else if (release.publishedAt) {
        const until = new Date(release.publishedAt).toISOString();
        const sinceDate = new Date(release.publishedAt);
        sinceDate.setDate(sinceDate.getDate() - 30);
        const targetBranch = release.targetCommitish?.trim() || undefined;
        releaseCommits = await fetchGitHubCommits(
          owner,
          repo,
          sinceDate.toISOString(),
          until,
          targetBranch
        );
      } else {
        releaseCommits = await fetchCommitsByTag(owner, repo, release.tag);
      }

      releaseCommits.forEach((commit) => {
        if (!commitsBySha.has(commit.sha)) {
          commitsBySha.set(commit.sha, commit);
        }
      });
    } catch (error) {
      console.warn(
        `Skipping release ${release.tag} due to error:`,
        error
      );
    }
  }

  return Array.from(commitsBySha.values()).sort((a, b) => {
    const aDate = new Date(a.commit.author.date).getTime();
    const bDate = new Date(b.commit.author.date).getTime();
    return bDate - aDate;
  });
}

/**
 * Fetch commit labels (PR labels associated with commit)
 */
async function fetchCommitLabels(
  owner: string,
  repo: string,
  sha: string
): Promise<string[]> {
  const client = getGitHubClient();
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/pulls`;

  try {
    const response = await client.fetch(url, {
      headers: {
        Accept: 'application/vnd.github.groot-preview+json',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const labelSet = new Set<string>();

    if (Array.isArray(data)) {
      data.forEach((pull: { labels?: Array<{ name?: string }> }) => {
        if (Array.isArray(pull?.labels)) {
          pull.labels.forEach((label: { name?: string }) => {
            if (label?.name) {
              labelSet.add(label.name);
            }
          });
        }
      });
    }

    return Array.from(labelSet);
  } catch {
    return [];
  }
}

/**
 * Filter commits by labels
 */
async function filterCommitsByLabels(
  owner: string,
  repo: string,
  commits: GitHubCommit[],
  includeLabels: string[],
  excludeLabels: string[]
): Promise<GitHubCommit[]> {
  const filtered: GitHubCommit[] = [];

  for (const commit of commits) {
    const labels = await fetchCommitLabels(owner, repo, commit.sha);

    if (includeLabels.length > 0) {
      const hasInclude = labels.some((label) =>
        includeLabels.includes(label)
      );
      if (!hasInclude) {
        continue;
      }
    }

    if (excludeLabels.length > 0) {
      const hasExclude = labels.some((label) =>
        excludeLabels.includes(label)
      );
      if (hasExclude) {
        continue;
      }
    }

    filtered.push(commit);
  }

  return filtered;
}

/**
 * Get commits based on filters
 */
export async function getCommitsForFilters(
  owner: string,
  repo: string,
  filters?: PatchNoteFilters,
  branch?: string
): Promise<GitHubCommit[]> {
  const effectiveFilters = normalizeFilters(filters);

  let commits: GitHubCommit[] = [];

  if (
    effectiveFilters.mode === 'release' &&
    effectiveFilters.releases &&
    effectiveFilters.releases.length > 0
  ) {
    commits = await collectCommitsForReleases(
      owner,
      repo,
      effectiveFilters.releases
    );
  } else {
    let since: string | undefined;
    let until: string | undefined;

    if (
      effectiveFilters.mode === 'custom' &&
      effectiveFilters.customRange?.since &&
      effectiveFilters.customRange?.until
    ) {
      since = new Date(effectiveFilters.customRange.since).toISOString();
      until = new Date(effectiveFilters.customRange.until).toISOString();
    } else {
      const preset: TimePreset =
        effectiveFilters.preset &&
        ['1day', '1week', '1month'].includes(effectiveFilters.preset)
          ? (effectiveFilters.preset as TimePreset)
          : '1week';
      const range = getDateRange(preset);
      since = range.since;
      until = range.until;
    }

    commits = await fetchGitHubCommits(owner, repo, since, until, branch);
  }

  // Filter by tags
  const includeTags = effectiveFilters.includeTags ?? [];
  const excludeTags = effectiveFilters.excludeTags ?? [];
  if (includeTags.length > 0 || excludeTags.length > 0) {
    const tags = await fetchGitHubTags(owner, repo);
    const tagMap = new Map<string, string[]>();
    tags.forEach((tag) => {
      const current = tagMap.get(tag.commitSha) ?? [];
      current.push(tag.name);
      tagMap.set(tag.commitSha, current);
    });

    commits = commits.filter((commit) => {
      const commitTags = tagMap.get(commit.sha) ?? [];
      if (
        includeTags.length > 0 &&
        !commitTags.some((tag) => includeTags.includes(tag))
      ) {
        return false;
      }
      if (
        excludeTags.length > 0 &&
        commitTags.some((tag) => excludeTags.includes(tag))
      ) {
        return false;
      }
      return true;
    });
  }

  // Filter by labels
  const includeLabels = effectiveFilters.includeLabels ?? [];
  const excludeLabels = effectiveFilters.excludeLabels ?? [];
  if (includeLabels.length > 0 || excludeLabels.length > 0) {
    commits = await filterCommitsByLabels(
      owner,
      repo,
      commits,
      includeLabels,
      excludeLabels
    );
  }

  return commits;
}
