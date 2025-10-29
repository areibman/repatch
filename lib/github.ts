/**
 * GitHub API Integration
 * 
 * This module provides a unified interface for interacting with the GitHub API.
 * It has been refactored into focused sub-modules for better maintainability:
 * - lib/github/client.ts - Core client with rate limiting and error handling
 * - lib/github/pagination.ts - Unified pagination utilities
 * - lib/github/cache.ts - Caching layer for expensive API calls
 * - lib/github/errors.ts - Consistent error handling
 * - lib/github/repositories.ts - Repository data (branches, tags, releases, labels)
 * - lib/github/commits.ts - Commit fetching and filtering
 * - lib/github/stats.ts - Repository statistics
 * - lib/github/utils.ts - Utility functions
 * 
 * @module github
 */

// Re-export types
export type { GitHubCommit } from './github/commits';
export type { RepoStats } from './github/stats';
export type {
  GitHubBranch,
  GitHubTag,
  GitHubRelease,
} from './github/repositories';

// Re-export repository functions
export {
  fetchGitHubBranches,
  fetchGitHubTags,
  fetchGitHubReleases,
  fetchGitHubLabels,
} from './github/repositories';

// Re-export commit functions
export {
  fetchGitHubCommits,
  fetchCommitStats,
  fetchCommitDiff,
  fetchPullRequestDetails,
  getCommitsForFilters,
} from './github/commits';

// Re-export stats functions
export { getRepoStats, generateBoilerplateContent } from './github/stats';

// Re-export utility functions
export { parseGitHubUrl, getDateRange } from './github/utils';

// Re-export error types for advanced usage
export { GitHubError, isRateLimitError } from './github/errors';
