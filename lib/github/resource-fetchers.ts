/**
 * GitHub Resource Fetchers
 * Functions for fetching branches, tags, releases, labels, and commits
 */

import { fetchAllPages, fetchSinglePage } from "./pagination";
import { getGitHubClient } from "./client";
import type {
  GitHubBranch,
  GitHubTag,
  GitHubRelease,
  GitHubCommit,
} from "./types";

/**
 * Fetch branches from GitHub repository
 */
export async function fetchGitHubBranches(
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  const endpoint = `/repos/${owner}/${repo}/branches`;
  const branches = await fetchAllPages<{
    name: string;
    protected?: boolean;
  }>(endpoint, {
    perPage: 100,
    maxPages: 5, // 500 branches max
    maxItems: 500,
  });

  const result: GitHubBranch[] = branches.map((branch) => ({
    name: branch.name,
    protected: branch.protected || false,
  }));

  // Sort branches: main/master first, then alphabetically
  return result.sort((a, b) => {
    if (a.name === "main") return -1;
    if (b.name === "main") return 1;
    if (a.name === "master") return -1;
    if (b.name === "master") return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Fetch tags from GitHub repository
 */
export async function fetchGitHubTags(
  owner: string,
  repo: string
): Promise<GitHubTag[]> {
  const endpoint = `/repos/${owner}/${repo}/tags`;
  const tags = await fetchAllPages<{
    name?: string;
    commit?: { sha?: string };
  }>(endpoint, {
    perPage: 100,
    maxPages: 10, // 1000 tags max
    maxItems: 1000,
  });

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

/**
 * Fetch releases from GitHub repository
 */
export async function fetchGitHubReleases(
  owner: string,
  repo: string
): Promise<GitHubRelease[]> {
  const endpoint = `/repos/${owner}/${repo}/releases`;
  const releases = await fetchAllPages<{
    id: number;
    tag_name: string;
    name: string | null;
    published_at: string | null;
    target_commitish: string;
  }>(endpoint, {
    perPage: 50,
    maxPages: 10, // 500 releases max
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

/**
 * Fetch labels from GitHub repository
 */
export async function fetchGitHubLabels(
  owner: string,
  repo: string
): Promise<string[]> {
  const endpoint = `/repos/${owner}/${repo}/labels`;
  const labels = await fetchAllPages<{ name?: string }>(endpoint, {
    perPage: 100,
    maxPages: 10, // 1000 labels max
    maxItems: 1000,
  });

  const result: string[] = [];
  for (const label of labels) {
    if (label?.name) {
      result.push(label.name);
    }
  }

  return result;
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
  let endpoint = `/repos/${owner}/${repo}/commits?since=${since}&until=${until}&per_page=100`;

  if (branch) {
    endpoint += `&sha=${encodeURIComponent(branch)}`;
  }

  // Commits API can return large datasets, so we use a more conservative limit
  const commits = await fetchAllPages<GitHubCommit>(endpoint, {
    perPage: 100,
    maxPages: 10, // 1000 commits max per request
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
): Promise<{ additions: number; deletions: number }> {
  try {
    const commit = await fetchSinglePage<{
      stats?: { additions?: number; deletions?: number };
    }>(`/repos/${owner}/${repo}/commits/${sha}`, {
      cacheKey: `commit-stats:${owner}:${repo}:${sha}`,
      cacheTTL: 3600, // Cache commit stats for 1 hour
    });

    return {
      additions: commit.stats?.additions || 0,
      deletions: commit.stats?.deletions || 0,
    };
  } catch (error) {
    // Return zeros instead of throwing for missing stats
    console.warn(
      `[GitHub] Failed to fetch stats for commit ${sha}:`,
      error instanceof Error ? error.message : error
    );
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
  try {
    // For diff format, we need to use Accept header with fetch directly
    // since the client's request method uses JSON parsing
    const headers: HeadersInit = {
      Accept: "application/vnd.github.v3.diff",
      "User-Agent": "Repatch-App",
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
      { headers }
    );

    if (!response.ok) {
      return "";
    }

    return response.text();
  } catch (error) {
    console.warn(
      `[GitHub] Failed to fetch diff for commit ${sha}:`,
      error instanceof Error ? error.message : error
    );
    return "";
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
  try {
    const client = getGitHubClient();

    // Fetch PR details
    const prData = await client.request<{
      title: string;
      body: string | null;
    }>(`/repos/${owner}/${repo}/pulls/${prNumber}`, {
      cacheKey: `pr:${owner}:${repo}:${prNumber}`,
      cacheTTL: 600, // Cache PRs for 10 minutes
    });

    // Fetch PR comments
    let comments: Array<{ author: string; body: string }> = [];
    try {
      const commentsData = await fetchAllPages<{
        user?: { login?: string };
        body?: string;
      }>(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
        perPage: 100,
        maxPages: 5,
        maxItems: 500,
      });

      comments = commentsData.map((comment) => ({
        author: comment.user?.login || "unknown",
        body: comment.body || "",
      }));
    } catch (error) {
      console.warn(
        `[GitHub] Failed to fetch comments for PR #${prNumber}:`,
        error instanceof Error ? error.message : error
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
      try {
        const issueData = await client.request<{
          title: string;
          body: string | null;
        }>(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
          cacheKey: `issue:${owner}:${repo}:${issueNumber}`,
          cacheTTL: 600,
        });

        issueTitle = issueData.title;
        issueBody = issueData.body;
      } catch (error) {
        console.warn(
          `[GitHub] Failed to fetch issue #${issueNumber}:`,
          error instanceof Error ? error.message : error
        );
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
    console.warn(
      `[GitHub] Failed to fetch PR #${prNumber}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
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
  try {
    const client = getGitHubClient();
    const data = await client.request<{ commits?: GitHubCommit[] }>(
      `/repos/${owner}/${repo}/compare/${baseRef}...${headRef}`,
      {
        cacheKey: `compare:${owner}:${repo}:${baseRef}...${headRef}`,
        cacheTTL: 600,
      }
    );

    return Array.isArray(data?.commits) ? data.commits : [];
  } catch (error) {
    console.warn(
      `[GitHub] Failed to compare ${baseRef}...${headRef}:`,
      error instanceof Error ? error.message : error
    );
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
  const endpoint = `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(tag)}&per_page=100`;
  const commits = await fetchAllPages<GitHubCommit>(endpoint, {
    perPage: 100,
    maxPages: 10,
    maxItems: 1000,
  });

  return commits;
}

/**
 * Fetch commit labels (from associated PRs)
 */
export async function fetchCommitLabels(
  owner: string,
  repo: string,
  sha: string
): Promise<string[]> {
  try {
    const client = getGitHubClient();
    const data = await client.request<
      Array<{ labels?: Array<{ name?: string }> }>
    >(`/repos/${owner}/${repo}/commits/${sha}/pulls`, {
      headers: {
        Accept: "application/vnd.github.groot-preview+json",
      },
      cacheKey: `commit-labels:${owner}:${repo}:${sha}`,
      cacheTTL: 600,
    });

    const labelSet = new Set<string>();
    if (Array.isArray(data)) {
      for (const pull of data) {
        if (Array.isArray(pull?.labels)) {
          for (const label of pull.labels) {
            if (label?.name) {
              labelSet.add(label.name);
            }
          }
        }
      }
    }

    return Array.from(labelSet);
  } catch (error) {
    // Return empty array instead of throwing
    console.warn(
      `[GitHub] Failed to fetch labels for commit ${sha}:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}
