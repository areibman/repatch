/**
 * GitHub API Integration
 * 
 * Refactored GitHub API client using Octokit with:
 * - Modular structure (separated concerns)
 * - Consistent error handling
 * - Rate limiting and retry logic
 * - Response caching
 * - Centralized pagination
 * - No deprecated functions
 * 
 * @module lib/github
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type {
  GitHubCommit,
  RepoStats,
  GitHubBranch,
  GitHubTag,
  GitHubRelease,
  PullRequestDetails,
  CommitStats,
  RepoInfo,
  DateRange,
  PatchNoteFilters,
  TimePreset,
} from './types';

// ============================================================================
// CLIENT & UTILITIES
// ============================================================================
export {
  getOctokit,
  resetOctokit,
  hasGitHubToken,
  getRateLimit,
  waitForRateLimit,
} from './client';

export {
  GitHubApiError,
  RateLimitError,
  handleOctokitError,
  retryWithBackoff,
  safeExecute,
} from './error';

export {
  globalCache,
  GitHubCache,
  withCache,
  DEFAULT_CACHE_CONFIG,
  type CacheConfig,
} from './cache';

export {
  fetchPaginated,
  fetchAllWithOctokit,
  PaginationTracker,
  DEFAULT_PAGINATION,
  type PaginationConfig,
} from './pagination';

// ============================================================================
// REPOSITORY API
// ============================================================================
export {
  fetchGitHubBranches,
  fetchGitHubTags,
  fetchGitHubReleases,
  fetchGitHubLabels,
  parseGitHubUrl,
} from './api/repository';

// ============================================================================
// COMMITS API
// ============================================================================
export {
  fetchGitHubCommits,
  fetchCommitStats,
  fetchCommitDiff,
  fetchCommitsBetweenRefs,
  fetchCommitsByTag,
  fetchCommitLabels,
  getDateRange,
} from './api/commits';

// ============================================================================
// PULL REQUESTS API
// ============================================================================
export {
  fetchPullRequestDetails,
} from './api/pull-requests';

// ============================================================================
// FILTERING & AGGREGATION
// ============================================================================
export {
  getCommitsForFilters,
} from './api/filters';

export {
  getRepoStats,
} from './api/stats';

// ============================================================================
// UTILITIES
// ============================================================================
export {
  generateBoilerplateContent,
} from './utils/boilerplate';

// ============================================================================
// DOCUMENTATION
// ============================================================================

/**
 * ## Usage Examples
 * 
 * ### Fetching Branches
 * ```typescript
 * import { fetchGitHubBranches } from '@/lib/github';
 * 
 * const branches = await fetchGitHubBranches('owner', 'repo');
 * console.log(branches); // [{ name: 'main', protected: true }, ...]
 * ```
 * 
 * ### Fetching Commits with Filters
 * ```typescript
 * import { getCommitsForFilters } from '@/lib/github';
 * 
 * const commits = await getCommitsForFilters('owner', 'repo', {
 *   mode: 'preset',
 *   preset: '1week',
 * });
 * ```
 * 
 * ### Getting Repository Stats
 * ```typescript
 * import { getRepoStats } from '@/lib/github';
 * 
 * const stats = await getRepoStats('owner', 'repo', filters);
 * console.log(stats.commits, stats.additions, stats.deletions);
 * ```
 * 
 * ### Rate Limit Management
 * ```typescript
 * import { getRateLimit, waitForRateLimit } from '@/lib/github';
 * 
 * const limit = await getRateLimit();
 * console.log(`${limit.remaining}/${limit.limit} calls remaining`);
 * 
 * // Wait if we're close to the limit
 * await waitForRateLimit(10); // Wait if < 10 calls remaining
 * ```
 * 
 * ### Using Cache
 * ```typescript
 * import { fetchGitHubBranches, globalCache } from '@/lib/github';
 * 
 * // First call - fetches from API
 * const branches1 = await fetchGitHubBranches('owner', 'repo');
 * 
 * // Second call - returns from cache (within TTL)
 * const branches2 = await fetchGitHubBranches('owner', 'repo');
 * 
 * // Clear cache if needed
 * globalCache.clear();
 * ```
 * 
 * ### Error Handling
 * ```typescript
 * import { fetchGitHubCommits, GitHubApiError, RateLimitError } from '@/lib/github';
 * 
 * try {
 *   const commits = await fetchGitHubCommits('owner', 'repo', since, until);
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     console.error('Rate limited until:', error.resetAt);
 *   } else if (error instanceof GitHubApiError) {
 *     console.error('GitHub API error:', error.message, error.statusCode);
 *   }
 * }
 * ```
 * 
 * ## Migration Notes
 * 
 * This refactored version removes the following deprecated functions:
 * - `generateVideoData` - Use `generateVideoTopChangesFromContent` from ai-summarizer.ts
 * - `generateVideoDataFromAI` - Use `generateVideoTopChangesFromContent` from ai-summarizer.ts
 * 
 * All other functions maintain backward compatibility with the same signatures.
 * 
 * ## Architecture
 * 
 * The GitHub integration is now organized as follows:
 * 
 * - `client.ts` - Octokit client with authentication and rate limiting
 * - `error.ts` - Error handling utilities
 * - `cache.ts` - Response caching layer
 * - `pagination.ts` - Pagination utilities
 * - `types.ts` - Type definitions
 * - `api/repository.ts` - Branch, tag, release, label APIs
 * - `api/commits.ts` - Commit fetching and stats
 * - `api/pull-requests.ts` - Pull request details
 * - `api/filters.ts` - Commit filtering logic
 * - `api/stats.ts` - Statistics aggregation
 * - `utils/boilerplate.ts` - Content generation helpers
 */

