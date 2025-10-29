/**
 * GitHub API Integration
 * 
 * Refactored modular structure:
 * - client.ts: Core API client with rate limiting and error handling
 * - pagination.ts: Shared pagination logic
 * - cache.ts: Caching layer for expensive API calls
 * - repositories.ts: Branch, tag, release, and label operations
 * - commits.ts: Commit-related operations
 * - filters.ts: Commit filtering logic
 * - stats.ts: Repository statistics aggregation
 * - content.ts: Content generation utilities
 * - utils.ts: Helper functions
 */

// Export types
export type { GitHubCommit } from './commits';
export type { RepoStats } from './stats';
export type { GitHubBranch, GitHubTag, GitHubRelease } from './repositories';
export type { CommitStats, PullRequestDetails } from './commits';
export type { GitHubApiError } from './client';

// Export utilities
export { parseGitHubUrl, getDateRange } from './utils';

// Export repository operations
export {
  fetchGitHubBranches,
  fetchGitHubTags,
  fetchGitHubReleases,
  fetchGitHubLabels,
} from './repositories';

// Export commit operations
export {
  fetchGitHubCommits,
  fetchCommitStats,
  fetchCommitDiff,
  fetchPullRequestDetails,
  fetchCommitsBetweenRefs,
  fetchCommitsByTag,
  fetchCommitLabels,
} from './commits';

// Export filtering and stats
export { getCommitsForFilters } from './filters';
export { getRepoStats } from './stats';

// Export content generation
export { generateBoilerplateContent } from './content';

// Export client utilities (for advanced usage)
export { githubRequest, getRateLimitInfo, GitHubApiException } from './client';
export { paginateGitHubApi, PAGINATION_LIMITS } from './pagination';
export { cachedGitHubRequest, createCacheKey, clearCache, CACHE_TTL } from './cache';
