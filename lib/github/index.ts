/**
 * GitHub API utilities
 * 
 * Refactored from monolithic file into focused modules:
 * - client.ts: Core API client with rate limiting and caching
 * - pagination.ts: Unified pagination logic
 * - resource-fetchers.ts: Resource fetching functions
 * - commit-filters.ts: Commit filtering logic
 * - stats.ts: Statistics aggregation
 * - content.ts: Content generation
 * - types.ts: Shared types and utilities
 */

// Types and utilities
export type {
  GitHubCommit,
  RepoStats,
  GitHubTag,
  GitHubRelease,
  GitHubBranch,
} from "./types";

export { parseGitHubUrl, getDateRange } from "./types";

// Resource fetchers
export {
  fetchGitHubBranches,
  fetchGitHubTags,
  fetchGitHubReleases,
  fetchGitHubLabels,
  fetchGitHubCommits,
  fetchCommitStats,
  fetchCommitDiff,
  fetchPullRequestDetails,
  fetchCommitsBetweenRefs,
  fetchCommitsByTag,
  fetchCommitLabels,
} from "./resource-fetchers";

// Commit filtering
export { getCommitsForFilters } from "./commit-filters";

// Statistics
export { getRepoStats } from "./stats";

// Content generation
export { generateBoilerplateContent } from "./content";

// Client (for advanced usage)
export { GitHubClient, GitHubAPIError, getGitHubClient } from "./client";
