/**
 * GitHub API utilities
 * Refactored modular structure with consistent error handling, pagination, and caching
 */

// Client exports
export { getGitHubClient, GitHubClient } from './client';
export type { GitHubClientConfig } from './client';

// Pagination exports
export { paginate, paginateMap, getPaginationMetadata } from './pagination';
export type { PaginationOptions, PaginationResult } from './pagination';

// Type exports
export type {
  GitHubCommit,
  RepoStats,
  GitHubTag,
  GitHubRelease,
  GitHubBranch,
  GitHubLabel,
  PullRequestDetails,
  CommitStats,
} from './types';

// Utility exports
export { parseGitHubUrl, getDateRange, sortBranches } from './utils';

// API exports
export { fetchGitHubBranches } from './branches';
export { fetchGitHubTags } from './tags';
export { fetchGitHubReleases } from './releases';
export { fetchGitHubLabels } from './labels';
export {
  fetchGitHubCommits,
  fetchCommitStats,
  fetchCommitDiff,
  fetchPullRequestDetails,
  getCommitsForFilters,
} from './commits';
export { getRepoStats } from './stats';
export { generateBoilerplateContent } from './content';
