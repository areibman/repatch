/**
 * GitHub API utilities for fetching repository data
 * 
 * This file re-exports from the new modular structure in ./github/
 * providing backward compatibility while offering:
 * - Consistent error handling
 * - Shared pagination logic
 * - Rate limiting and caching
 * - No deprecated functions
 */

// Re-export everything from the modular structure
export {
  // Types
  type GitHubCommit,
  type RepoStats,
  type GitHubTag,
  type GitHubRelease,
  type GitHubBranch,
  type GitHubLabel,
  type PullRequestDetails,
  type CommitStats,
  
  // Utilities
  parseGitHubUrl,
  getDateRange,
  
  // API functions
  fetchGitHubBranches,
  fetchGitHubTags,
  fetchGitHubReleases,
  fetchGitHubLabels,
  fetchGitHubCommits,
  fetchCommitStats,
  fetchCommitDiff,
  fetchPullRequestDetails,
  getCommitsForFilters,
  getRepoStats,
  generateBoilerplateContent,
} from './github/index';
