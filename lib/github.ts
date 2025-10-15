/**
 * GitHub API utilities for fetching repository data
 */

import { PatchNoteFilters, TimePreset, VideoData } from "../types/patch-note";
import {
  formatFilterSummary,
  formatFilterDetailLabel,
  getPresetLabel,
  normalizeFilters,
} from "./filter-utils";

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

export interface RepoStats {
  commits: number;
  additions: number;
  deletions: number;
  contributors: string[];
  commitMessages: string[];
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
      repo: match[2].replace(/\.git$/, ""),
    };
  }
  return null;
}

/**
 * Calculate date range based on time period
 */
export function getDateRange(timePeriod: TimePreset): {
  since: string;
  until: string;
} {
  const now = new Date();
  const until = now.toISOString();

  const since = new Date(now);
  switch (timePeriod) {
    case "1day":
      since.setDate(since.getDate() - 1);
      break;
    case "1week":
      since.setDate(since.getDate() - 7);
      break;
    case "1month":
      since.setMonth(since.getMonth() - 1);
      break;
  }

  return { since: since.toISOString(), until };
}

/**
 * Get headers for GitHub API requests with authentication if available
 */
function getGitHubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Repatch-App',
  };

  // Add authentication token if available
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Fetch branches from GitHub repository with pagination support
 */
export async function fetchGitHubBranches(
  owner: string,
  repo: string
): Promise<{ name: string; protected: boolean }[]> {
  const allBranches: { name: string; protected: boolean }[] = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/branches?per_page=${perPage}&page=${page}`;
    
    const response = await fetch(url, {
      headers: getGitHubHeaders(),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch branches from GitHub';
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const branches = await response.json();
    
    if (branches.length === 0) {
      break; // No more branches
    }
    
    allBranches.push(...branches.map((branch: any) => ({
      name: branch.name,
      protected: branch.protected || false,
    })));
    
    // If we got fewer branches than requested, we've reached the end
    if (branches.length < perPage) {
      break;
    }
    
    page++;
    
    // Safety limit: stop at 500 branches to avoid infinite loops
    if (allBranches.length >= 500) {
      break;
    }
  }
  
  // Sort branches: main/master first, then alphabetically
  return allBranches.sort((a, b) => {
    if (a.name === 'main') return -1;
    if (b.name === 'main') return 1;
    if (a.name === 'master') return -1;
    if (b.name === 'master') return 1;
    return a.name.localeCompare(b.name);
  });
}

export interface GitHubTag {
  name: string;
  commitSha: string;
}

export async function fetchGitHubTags(
  owner: string,
  repo: string
): Promise<GitHubTag[]> {
  const tags: GitHubTag[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/tags?per_page=${perPage}&page=${page}`;
    const response = await fetch(url, {
      headers: getGitHubHeaders(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch tags from GitHub";
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    data.forEach((tag: any) => {
      if (tag?.name && tag?.commit?.sha) {
        tags.push({ name: tag.name, commitSha: tag.commit.sha });
      }
    });

    if (data.length < perPage) {
      break;
    }

    page += 1;
    if (page > 10) {
      break;
    }
  }

  return tags;
}

export interface GitHubRelease {
  id: number;
  tagName: string;
  name: string | null;
  publishedAt: string | null;
  targetCommitish: string;
}

export async function fetchGitHubReleases(
  owner: string,
  repo: string
): Promise<GitHubRelease[]> {
  const releases: GitHubRelease[] = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${perPage}&page=${page}`;
    const response = await fetch(url, {
      headers: getGitHubHeaders(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch releases from GitHub";
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    data.forEach((release: any) => {
      releases.push({
        id: release.id,
        tagName: release.tag_name,
        name: release.name,
        publishedAt: release.published_at,
        targetCommitish: release.target_commitish,
      });
    });

    if (data.length < perPage) {
      break;
    }

    page += 1;
    if (page > 10) {
      break;
    }
  }

  return releases;
}

export async function fetchGitHubLabels(
  owner: string,
  repo: string
): Promise<string[]> {
  const labels: string[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/labels?per_page=${perPage}&page=${page}`;
    const response = await fetch(url, {
      headers: getGitHubHeaders(),
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch labels from GitHub";
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    data.forEach((label: any) => {
      if (label?.name) {
        labels.push(label.name);
      }
    });

    if (data.length < perPage) {
      break;
    }

    page += 1;
    if (page > 10) {
      break;
    }
  }

  return labels;
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
  let url = `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&until=${until}&per_page=100`;
  
  // Add branch parameter if specified
  if (branch) {
    url += `&sha=${encodeURIComponent(branch)}`;
  }
  
  const response = await fetch(url, {
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to fetch commits from GitHub';
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

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
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;

  const response = await fetch(url, {
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    return { additions: 0, deletions: 0 };
  }

  const data = await response.json();
  return {
    additions: data.stats?.additions || 0,
    deletions: data.stats?.deletions || 0,
  };
}

/**
 * Fetch commit diff/patch for AI summarization
 */
export async function fetchCommitDiff(
  owner: string,
  repo: string,
  sha: string
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;

  const response = await fetch(url, {
    headers: {
      ...getGitHubHeaders(),
      Accept: 'application/vnd.github.v3.diff',
    },
  });

  if (!response.ok) {
    return '';
  }

  return response.text();
}

async function fetchCommitsBetweenRefs(
  owner: string,
  repo: string,
  baseRef: string,
  headRef: string
): Promise<GitHubCommit[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/compare/${baseRef}...${headRef}`;
  const response = await fetch(url, {
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    let errorMessage = "Failed to compare Git references";
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (Array.isArray(data?.commits)) {
    return data.commits as GitHubCommit[];
  }

  return [];
}

async function fetchCommitsByTag(
  owner: string,
  repo: string,
  tag: string
): Promise<GitHubCommit[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(
    tag
  )}&per_page=100`;
  const response = await fetch(url, {
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    let errorMessage = "Failed to fetch commits for tag";
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return Array.isArray(data) ? (data as GitHubCommit[]) : [];
}

async function collectCommitsForReleases(
  owner: string,
  repo: string,
  releases: NonNullable<PatchNoteFilters["releases"]>
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
        releaseCommits = await fetchGitHubCommits(
          owner,
          repo,
          sinceDate.toISOString(),
          until
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

async function fetchCommitLabels(
  owner: string,
  repo: string,
  sha: string
): Promise<string[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/pulls`;
  const response = await fetch(url, {
    headers: {
      ...getGitHubHeaders(),
      Accept: "application/vnd.github.groot-preview+json",
    },
  });

  if (!response.ok) {
    return [];
  }

  try {
    const data = await response.json();
    const labelSet = new Set<string>();
    if (Array.isArray(data)) {
      data.forEach((pull: any) => {
        if (Array.isArray(pull?.labels)) {
          pull.labels.forEach((label: any) => {
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

export async function getCommitsForFilters(
  owner: string,
  repo: string,
  filters?: PatchNoteFilters,
  branch?: string
): Promise<GitHubCommit[]> {
  const effectiveFilters = normalizeFilters(filters);

  let commits: GitHubCommit[] = [];

  if (
    effectiveFilters.mode === "release" &&
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
      effectiveFilters.mode === "custom" &&
      effectiveFilters.customRange?.since &&
      effectiveFilters.customRange?.until
    ) {
      since = new Date(effectiveFilters.customRange.since).toISOString();
      until = new Date(effectiveFilters.customRange.until).toISOString();
    } else {
      const preset: TimePreset =
        effectiveFilters.preset &&
        ["1day", "1week", "1month"].includes(effectiveFilters.preset)
          ? (effectiveFilters.preset as TimePreset)
          : "1week";
      const range = getDateRange(preset);
      since = range.since;
      until = range.until;
    }

    commits = await fetchGitHubCommits(owner, repo, since, until, branch);
  }

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

/**
 * Aggregate repository statistics from commits
 */
export async function getRepoStats(
  owner: string,
  repo: string,
  filters?: PatchNoteFilters,
  branch?: string
): Promise<RepoStats> {
  const commits = await getCommitsForFilters(owner, repo, filters, branch);

  if (commits.length === 0) {
    return {
      commits: 0,
      additions: 0,
      deletions: 0,
      contributors: [],
      commitMessages: [],
    };
  }

  // Extract unique contributors
  const contributorSet = new Set<string>();
  const commitMessages: string[] = [];

  commits.forEach((commit) => {
    if (commit.author?.login) {
      contributorSet.add(`@${commit.author.login}`);
    } else if (commit.commit.author.name) {
      contributorSet.add(commit.commit.author.name);
    }
    commitMessages.push(commit.commit.message);
  });

  // Fetch detailed stats for up to 20 most recent commits
  // (to avoid rate limiting, we sample instead of fetching all)
  const commitsToFetch = commits.slice(0, Math.min(20, commits.length));
  const statsPromises = commitsToFetch.map((commit) =>
    fetchCommitStats(owner, repo, commit.sha)
  );

  const stats = await Promise.all(statsPromises);

  // Calculate totals
  const additions = stats.reduce((sum, s) => sum + s.additions, 0);
  const deletions = stats.reduce((sum, s) => sum + s.deletions, 0);

  // Estimate total changes if we didn't fetch all commits
  const estimationFactor = commits.length / commitsToFetch.length;
  const estimatedAdditions = Math.round(additions * estimationFactor);
  const estimatedDeletions = Math.round(deletions * estimationFactor);

  return {
    commits: commits.length,
    additions: estimatedAdditions,
    deletions: estimatedDeletions,
    contributors: Array.from(contributorSet),
    commitMessages,
  };
}

/**
 * Generate boilerplate patch note content
 */
export function generateBoilerplateContent(
  repoName: string,
  filters: PatchNoteFilters | undefined,
  stats: RepoStats
): string {
  const descriptor = filters?.mode === "preset" && filters.preset
    ? getPresetLabel(filters.preset)
    : filters?.mode === "release"
    ? "Release Selection"
    : "Custom Range";
  const detailLabel = filters
    ? formatFilterDetailLabel(filters)
    : getPresetLabel("1week");

  const content = `# ${descriptor} Update for ${repoName}

## 📊 Overview

This summary covers changes made to the repository for ${detailLabel}.

**Period Statistics:**
- **${stats.commits}** commits
- **${stats.contributors.length}** active contributors
- **${stats.additions.toLocaleString()}** lines added
- **${stats.deletions.toLocaleString()}** lines removed

## 🚀 Highlights

${
  stats.commits > 0
    ? `
The team has been actively developing with ${stats.commits} commits during this timeframe.
Key areas of focus include ongoing development and improvements across the codebase.
`
    : "No commits were made during this period."
}

## 📝 Recent Commits

${stats.commitMessages
  .slice(0, 10)
  .map((msg) => `- ${msg.split("\n")[0]}`)
  .join("\n")}

${
  stats.commitMessages.length > 10
    ? `\n_...and ${stats.commitMessages.length - 10} more commits_`
    : ""
}

## 👥 Contributors

Thanks to all contributors who made this release possible:
${stats.contributors.join(", ")}

---

*Note: This is an auto-generated summary. AI-powered detailed analysis coming soon.*
`;

  return content;
}

/**
 * Generate video data using AI based on repository stats and commit messages
 */
// Generate video data from AI summaries (preferred method)
export function generateVideoDataFromAI(
  aiSummaries: Array<{
    sha: string;
    message: string;
    aiSummary: string;
    additions: number;
    deletions: number;
  }>,
  overallSummary?: string
): VideoData {
  console.log('📹 generateVideoDataFromAI called with', aiSummaries.length, 'summaries');
  
  // Take top 3 AI summaries for the main video content
  const topChanges = aiSummaries.slice(0, 3).map((summary) => {
    const commitTitle = summary.message.split("\n")[0];
    const title = commitTitle.length > 60 ? commitTitle.substring(0, 60) + "..." : commitTitle;
    console.log(`   ✨ Top Change: "${title}" → "${summary.aiSummary.substring(0, 50)}..."`);
    return {
      title,
      description: summary.aiSummary,
    };
  });

  // All changes list - shorter format for scrolling text
  const allChanges = aiSummaries.map((summary) => {
    const commitTitle = summary.message.split("\n")[0];
    return `${commitTitle}: ${summary.aiSummary}`;
  });

  console.log('📹 Generated video data:');
  console.log('   - Top changes:', topChanges.length);
  console.log('   - All changes:', allChanges.length);

  return {
    langCode: "en",
    topChanges,
    allChanges,
  };
}

// Generate video data from raw GitHub stats (fallback if no AI summaries)
export async function generateVideoData(
  repoName: string,
  filters: PatchNoteFilters | undefined,
  stats: RepoStats
): Promise<VideoData> {
  const filterLabel = formatFilterSummary(
    filters,
    filters?.mode === "release"
      ? "release"
      : filters?.mode === "custom"
      ? "custom"
      : filters?.preset ?? "1week"
  );

  // Create a summary of the changes for AI processing
  const changesSummary = `
Repository: ${repoName}
Period: ${filterLabel}
Commits: ${stats.commits}
Contributors: ${stats.contributors.length}
Lines added: ${stats.additions}
Lines removed: ${stats.deletions}

Recent commit messages:
${stats.commitMessages
  .slice(0, 20)
  .map((msg, i) => `${i + 1}. ${msg.split("\n")[0]}`)
  .join("\n")}
`;

  try {
    // For now, we'll create a simple fallback structure
    // In a real implementation, you would call an AI service here
    const topChanges = stats.commitMessages.slice(0, 5).map((msg, i) => ({
      title: `Change ${i + 1}`,
      description:
        msg.split("\n")[0].substring(0, 100) + (msg.length > 100 ? "..." : ""),
    }));

    const allChanges = stats.commitMessages
      .slice(0, 25)
      .map(
        (msg) =>
          msg.split("\n")[0].substring(0, 80) + (msg.length > 80 ? "..." : "")
      );

    return {
      langCode: "en",
      topChanges,
      allChanges,
    };
  } catch (error) {
    console.error("Error generating video data:", error);

    // Fallback data
    return {
      langCode: "en",
      topChanges: [
        {
          title: "Repository Updates",
          description: `Active development with ${
            stats.commits
          } commits during this ${filterLabel.toLowerCase()} window`,
        },
      ],
      allChanges: stats.commitMessages
        .slice(0, 10)
        .map(
          (msg) =>
            msg.split("\n")[0].substring(0, 60) + (msg.length > 60 ? "..." : "")
        ),
    };
  }
}
