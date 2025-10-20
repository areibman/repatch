/**
 * GitHub API utilities for fetching repository data
 */

import type { PatchNoteFilters, TimePeriod, TimePreset, VideoData } from "../types/patch-note";

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

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  published_at: string | null;
  created_at: string;
  draft: boolean;
  prerelease: boolean;
  target_commitish: string;
}

export interface RepoStats {
  commits: number;
  additions: number;
  deletions: number;
  contributors: string[];
  commitMessages: string[];
}

export interface RepoStatsWithContext extends RepoStats {
  timePeriod: TimePeriod;
  contextLabel: string;
  releaseBaseTag?: string | null;
}

export interface CommitHistory {
  commits: GitHubCommit[];
  timePeriod: TimePeriod;
  contextLabel: string;
  since?: string;
  until?: string;
  releaseBaseTag?: string | null;
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
export function getDateRange(timePeriod: TimePreset, referenceDate: Date = new Date()): {
  since: string;
  until: string;
} {
  const now = new Date(referenceDate);
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

function getGitHubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Repatch-App",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

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
      let errorMessage = "Failed to fetch branches from GitHub";
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
      break;
    }

    allBranches.push(
      ...branches.map((branch: any) => ({
        name: branch.name,
        protected: branch.protected || false,
      }))
    );

    if (branches.length < perPage) {
      break;
    }

    page++;

    if (allBranches.length >= 500) {
      break;
    }
  }

  return allBranches.sort((a, b) => {
    if (a.name === "main") return -1;
    if (b.name === "main") return 1;
    if (a.name === "master") return -1;
    if (b.name === "master") return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function fetchGitHubCommits(
  owner: string,
  repo: string,
  since: string,
  until: string,
  branch?: string
): Promise<GitHubCommit[]> {
  let url = `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&until=${until}&per_page=100`;

  if (branch) {
    url += `&sha=${encodeURIComponent(branch)}`;
  }

  const response = await fetch(url, {
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    let errorMessage = "Failed to fetch commits from GitHub";
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

export async function fetchCommitDiff(
  owner: string,
  repo: string,
  sha: string
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;

  const response = await fetch(url, {
    headers: {
      ...getGitHubHeaders(),
      Accept: "application/vnd.github.v3.diff",
    },
  });

  if (!response.ok) {
    return "";
  }

  return response.text();
}

export async function fetchGitHubReleases(
  owner: string,
  repo: string
): Promise<GitHubRelease[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`;
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

  return response.json();
}

function formatDateRangeLabel(since?: string, until?: string): string {
  if (!since || !until) {
    return "Custom Range";
  }
  const sinceDate = since.split("T")[0];
  const untilDate = until.split("T")[0];
  return `Custom Range (${sinceDate} – ${untilDate})`;
}

async function collectReleaseCommits(
  owner: string,
  repo: string,
  releaseTag: string
): Promise<CommitHistory> {
  const releases = await fetchGitHubReleases(owner, repo);
  const sorted = releases
    .filter((release) => !release.draft)
    .sort((a, b) => {
      const aDate = new Date(a.published_at ?? a.created_at).getTime();
      const bDate = new Date(b.published_at ?? b.created_at).getTime();
      return bDate - aDate;
    });

  const index = sorted.findIndex((release) => release.tag_name === releaseTag);
  if (index === -1) {
    throw new Error(`Release ${releaseTag} not found`);
  }

  const current = sorted[index];
  const previous = sorted[index + 1] ?? null;

  if (previous) {
    const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(
      previous.tag_name
    )}...${encodeURIComponent(current.tag_name)}`;
    const compareResponse = await fetch(compareUrl, {
      headers: getGitHubHeaders(),
    });

    if (!compareResponse.ok) {
      let errorMessage = "Failed to fetch commits for selected release";
      try {
        const error = await compareResponse.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = `GitHub API error: ${compareResponse.status} ${compareResponse.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const compareData = await compareResponse.json();
    const commits: GitHubCommit[] = compareData.commits || [];

    return {
      commits,
      timePeriod: "release",
      contextLabel: current.name || `Release ${current.tag_name}`,
      since: previous.published_at ?? previous.created_at,
      until: current.published_at ?? current.created_at,
      releaseBaseTag: previous.tag_name,
    };
  }

  const until = current.published_at ?? current.created_at ?? new Date().toISOString();
  const untilDate = new Date(until);
  const sinceDate = new Date(untilDate);
  sinceDate.setMonth(sinceDate.getMonth() - 1);
  const since = sinceDate.toISOString();
  const commits = await fetchGitHubCommits(owner, repo, since, until, current.target_commitish || undefined);

  return {
    commits,
    timePeriod: "release",
    contextLabel: current.name || `Release ${current.tag_name}`,
    since,
    until,
    releaseBaseTag: null,
  };
}

async function fetchCommitLabelsForSha(
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

  const pulls = await response.json();
  const labels = new Set<string>();
  for (const pull of pulls) {
    if (!pull?.labels) continue;
    for (const label of pull.labels) {
      if (label?.name) {
        labels.add(String(label.name).toLowerCase());
      }
    }
  }
  return Array.from(labels);
}

async function applyLabelFilters(
  owner: string,
  repo: string,
  commits: GitHubCommit[],
  includeTags?: string[],
  excludeTags?: string[]
): Promise<GitHubCommit[]> {
  const hasInclude = Boolean(includeTags && includeTags.length > 0);
  const hasExclude = Boolean(excludeTags && excludeTags.length > 0);

  if (!hasInclude && !hasExclude) {
    return commits;
  }

  const normalizedInclude = (includeTags || []).map((tag) => tag.toLowerCase());
  const normalizedExclude = (excludeTags || []).map((tag) => tag.toLowerCase());

  const filtered: GitHubCommit[] = [];
  for (const commit of commits) {
    const labels = await fetchCommitLabelsForSha(owner, repo, commit.sha);
    const hasIncludedLabel =
      !hasInclude || labels.some((label) => normalizedInclude.includes(label));
    const hasExcludedLabel = labels.some((label) => normalizedExclude.includes(label));

    if (hasIncludedLabel && !hasExcludedLabel) {
      filtered.push(commit);
    }
  }

  return filtered;
}

export async function getCommitHistory(
  owner: string,
  repo: string,
  options: { branch?: string; filters?: PatchNoteFilters } = {}
): Promise<CommitHistory> {
  const { branch, filters } = options;
  const preset = filters?.preset ?? "1week";
  const includeTags = filters?.includeTags;
  const excludeTags = filters?.excludeTags;

  if (filters?.releaseTag) {
    const releaseHistory = await collectReleaseCommits(owner, repo, filters.releaseTag);
    const filteredCommits = await applyLabelFilters(
      owner,
      repo,
      releaseHistory.commits,
      includeTags,
      excludeTags
    );

    return {
      ...releaseHistory,
      commits: filteredCommits,
    };
  }

  if (filters?.customRange) {
    const { since, until } = filters.customRange;
    const commits = await fetchGitHubCommits(owner, repo, since, until, branch);
    const filteredCommits = await applyLabelFilters(owner, repo, commits, includeTags, excludeTags);
    return {
      commits: filteredCommits,
      timePeriod: "custom",
      contextLabel: formatDateRangeLabel(since, until),
      since,
      until,
      releaseBaseTag: null,
    };
  }

  const { since, until } = getDateRange(preset);
  const commits = await fetchGitHubCommits(owner, repo, since, until, branch);
  const filteredCommits = await applyLabelFilters(owner, repo, commits, includeTags, excludeTags);
  const contextLabel =
    preset === "1day"
      ? "Daily Update"
      : preset === "1week"
      ? "Weekly Update"
      : "Monthly Update";

  return {
    commits: filteredCommits,
    timePeriod: preset,
    contextLabel,
    since,
    until,
    releaseBaseTag: null,
  };
}

export async function getRepoStats(
  owner: string,
  repo: string,
  options: { branch?: string; filters?: PatchNoteFilters } = {}
): Promise<RepoStatsWithContext> {
  const history = await getCommitHistory(owner, repo, options);
  const commits = history.commits;

  if (commits.length === 0) {
    return {
      commits: 0,
      additions: 0,
      deletions: 0,
      contributors: [],
      commitMessages: [],
      timePeriod: history.timePeriod,
      contextLabel: history.contextLabel,
      releaseBaseTag: history.releaseBaseTag ?? null,
    };
  }

  const contributorSet = new Set<string>();
  const commitMessages: string[] = [];

  commits.forEach((commit) => {
    if (commit.author?.login) {
      contributorSet.add(`@${commit.author.login}`);
    } else if (commit.commit.author?.name) {
      contributorSet.add(commit.commit.author.name);
    }
    commitMessages.push(commit.commit.message);
  });

  const commitsToFetch = commits.slice(0, Math.min(20, commits.length));
  const statsPromises = commitsToFetch.map((commit) =>
    fetchCommitStats(owner, repo, commit.sha)
  );

  const stats = await Promise.all(statsPromises);

  const additions = stats.reduce((sum, s) => sum + s.additions, 0);
  const deletions = stats.reduce((sum, s) => sum + s.deletions, 0);

  const estimationFactor = commits.length / commitsToFetch.length;
  const estimatedAdditions = Math.round(additions * estimationFactor);
  const estimatedDeletions = Math.round(deletions * estimationFactor);

  return {
    commits: commits.length,
    additions: estimatedAdditions,
    deletions: estimatedDeletions,
    contributors: Array.from(contributorSet),
    commitMessages,
    timePeriod: history.timePeriod,
    contextLabel: history.contextLabel,
    releaseBaseTag: history.releaseBaseTag ?? null,
  };
}

export function generateBoilerplateContent(
  repoName: string,
  contextLabel: string,
  stats: RepoStats
): string {
  const content = `# ${contextLabel} for ${repoName}

## 📊 Overview

This summary covers changes made to the repository during ${contextLabel.toLowerCase()}.

**Period Statistics:**
- **${stats.commits}** commits
- **${stats.contributors.length}** active contributors
- **${stats.additions.toLocaleString()}** lines added
- **${stats.deletions.toLocaleString()}** lines removed

## 🚀 Highlights

${
  stats.commits > 0
    ? `The team has been actively developing with ${stats.commits} commits during this period.
Key areas of focus include ongoing development and improvements across the codebase.`
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

Thanks to all contributors who made this update possible:
${stats.contributors.join(", ")}

---

*Note: This is an auto-generated summary. AI-powered detailed analysis coming soon.*`;

  return content;
}

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
  const topChanges = aiSummaries.slice(0, 3).map((summary) => {
    const commitTitle = summary.message.split("\n")[0];
    const title = commitTitle.length > 60 ? commitTitle.substring(0, 60) + "..." : commitTitle;
    return {
      title,
      description: summary.aiSummary,
    };
  });

  const allChanges = aiSummaries.map((summary) => {
    const commitTitle = summary.message.split("\n")[0];
    return `${commitTitle}: ${summary.aiSummary}`;
  });

  return {
    langCode: "en",
    topChanges,
    allChanges,
  };
}

export async function generateVideoData(
  repoName: string,
  timePeriod: TimePeriod,
  stats: RepoStatsWithContext
): Promise<VideoData> {
  const periodLabel =
    timePeriod === "1day"
      ? "Daily"
      : timePeriod === "1week"
      ? "Weekly"
      : timePeriod === "1month"
      ? "Monthly"
      : stats.contextLabel || (timePeriod === "custom" ? "Custom Range" : "Release");

  const topChanges = stats.commitMessages.slice(0, 3).map((message) => ({
    title: message.split("\n")[0],
    description: `Part of the ${periodLabel.toLowerCase()} update for ${repoName}.`,
  }));

  const allChanges = stats.commitMessages.map((message) => message.split("\n")[0]);

  return {
    langCode: "en",
    topChanges,
    allChanges,
  };
}
