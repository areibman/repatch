/**
 * GitHub API operations
 * Re-exports existing services and adds unified metadata endpoint
 */

export * from './metadata';

// Re-export existing services for consistency
export { 
  fetchGitHubStats, 
  validateGitHubStatsInput 
} from '@/lib/services/github-stats.service';

export { 
  summarizeCommits, 
  validateSummarizeInput 
} from '@/lib/services/github-summarize.service';
