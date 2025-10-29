/**
 * GitHub Commits API
 */

import { getGitHubClient } from './client';
import { paginate } from './pagination';
import { fetchGitHubTags } from './tags';
import { normalizeFilters } from '@/lib/filter-utils';
import type { PatchNoteFilters, TimePreset } from '@/types/patch-note';
import type { GitHubCommit } from './types';
import type { PullRequestDetails, CommitStats } from './types';
import { getDateRange } from './utils';

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
  let endpoint = `/repos/${owner}/${repo}/commits?since=${since}&until=${until}`;

  // Add branch parameter if specified
  if (branch) {
    endpoint += `&sha=${encodeURIComponent(branch)}`;
  }

  const commits = await paginate<GitHubCommit>(client, endpoint, {
    maxPages: 10,
    perPage: 100,
    maxItems: 1000,
  });

  return commits;
}

/**
 * Fetch detailed commit stats including additions/deletions
 */
export async function fetchCommitStats(
  owner: string,
  repo: string,
  sha: string
): Promise<CommitStats> {
  const client = getGitHubClient();
  const endpoint = `/repos/${owner}/${repo}/commits/${sha}`;

  try {
    const data = await client.request<{
      stats?: { additions: number; deletions: number };
    }>(endpoint);

    return {
      additions: data.stats?.additions || 0,
      deletions: data.stats?.deletions || 0,
    };
  } catch {
    // Return zero stats on error instead of throwing
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
  const endpoint = `/repos/${owner}/${repo}/commits/${sha}`;

  try {
    return await client.requestText(endpoint, {
      headers: {
        Accept: 'application/vnd.github.v3.diff',
      },
    });
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
): Promise<PullRequestDetails | null> {
  const client = getGitHubClient();

  try {
    // Fetch PR details
    const prData = await client.request<{
      title: string;
      body: string | null;
    }>(`/repos/${owner}/${repo}/pulls/${prNumber}`);

    // Fetch PR comments
    let comments: Array<{ author: string; body: string }> = [];
    try {
      const commentsData = await paginate<{
        user?: { login?: string };
        body?: string;
      }>(client, `/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
        maxPages: 1,
        perPage: 100,
      });

      comments = commentsData
        .map((comment) => ({
          author: comment.user?.login || 'unknown',
          body: comment.body || '',
        }))
        .filter((c) => c.body); // Filter out empty comments
    } catch {
      // Comments are optional, continue without them
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
      try {
        const issueData = await client.request<{
          title: string;
          body: string | null;
        }>(`/repos/${owner}/${repo}/issues/${issueNumber}`);

        issueTitle = issueData.title;
        issueBody = issueData.body;
      } catch {
        // Issue fetch is optional, continue without it
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
  } catch (error) {
    console.warn(`Failed to fetch PR #${prNumber}:`, error);
    return null;
  }
}

/**
 * Fetch commits between two refs
 */
async function fetchCommitsBetweenRefs(
  owner: string,
  repo: string,
  baseRef: string,
  headRef: string
): Promise<GitHubCommit[]> {
  const client = getGitHubClient();
  const endpoint = `/repos/${owner}/${repo}/compare/${baseRef}...${headRef}`;

  try {
    const data = await client.request<{ commits?: GitHubCommit[] }>(endpoint);
    return Array.isArray(data?.commits) ? data.commits : [];
  } catch (error) {
    console.warn(
      `Failed to compare ${baseRef}...${headRef}:`,
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
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
  const endpoint = `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(tag)}`;

  try {
    const commits = await paginate<GitHubCommit>(client, endpoint, {
      maxPages: 10,
      perPage: 100,
      maxItems: 1000,
    });
    return commits;
  } catch (error) {
    console.warn(
      `Failed to fetch commits for tag ${tag}:`,
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
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
        error instanceof Error ? error.message : String(error)
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
 * Fetch commit labels (via associated PRs)
 */
async function fetchCommitLabels(
  owner: string,
  repo: string,
  sha: string
): Promise<string[]> {
  const client = getGitHubClient();
  const endpoint = `/repos/${owner}/${repo}/commits/${sha}/pulls`;

  try {
    const data = await client.request<
      Array<{ labels?: Array<{ name?: string }> }>
    >(endpoint, {
      headers: {
        Accept: 'application/vnd.github.groot-preview+json',
      },
    });

    const labelSet = new Set<string>();
    if (Array.isArray(data)) {
      data.forEach((pull) => {
        if (Array.isArray(pull?.labels)) {
          pull.labels.forEach((label) => {
            if (label?.name) {
              labelSet.add(label.name);
            }
          });
        }
      });
    }
    return Array.from(labelSet);
  } catch {
    // Return empty array on error instead of throwing
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
      const hasInclude = labels.some((label) => includeLabels.includes(label));
      if (!hasInclude) {
        continue;
      }
    }

    if (excludeLabels.length > 0) {
      const hasExclude = labels.some((label) => excludeLabels.includes(label));
      if (hasExclude) {
        continue;
      }
    }

    filtered.push(commit);
  }

  return filtered;
}

/**
 * Get commits for filters
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
