/**
 * GitHub Statistics Service
 * Pure functions for fetching repository statistics
 */

import { getRepoStats, type RepoStats } from '@/lib/github';
import type { PatchNoteFilters } from '@/types/patch-note';

/**
 * Service result type for consistent error handling
 */
export type ServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Input parameters for fetching GitHub stats
 */
export interface FetchGitHubStatsInput {
  readonly owner: string;
  readonly repo: string;
  readonly branch?: string;
  readonly filters?: PatchNoteFilters;
}

/**
 * Fetch repository statistics
 * Pure function that returns a ServiceResult
 */
export async function fetchGitHubStats(
  input: FetchGitHubStatsInput
): Promise<ServiceResult<RepoStats>> {
  try {
    const stats = await getRepoStats(
      input.owner,
      input.repo,
      input.filters,
      input.branch
    );

    return { success: true, data: stats };
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to fetch repository statistics';

    console.error('[GitHub Stats Service] Error:', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * Validate GitHub repository input
 * Returns validated input or error
 */
export function validateGitHubStatsInput(
  input: unknown
): ServiceResult<FetchGitHubStatsInput> {
  if (!input || typeof input !== 'object') {
    return { success: false, error: 'Invalid input: expected an object' };
  }

  const obj = input as Record<string, unknown>;

  if (!obj.owner || typeof obj.owner !== 'string') {
    return { success: false, error: 'Missing or invalid owner parameter' };
  }

  if (!obj.repo || typeof obj.repo !== 'string') {
    return { success: false, error: 'Missing or invalid repo parameter' };
  }

  return {
    success: true,
    data: {
      owner: obj.owner,
      repo: obj.repo,
      branch: typeof obj.branch === 'string' ? obj.branch : undefined,
      filters: obj.filters as PatchNoteFilters | undefined,
    },
  };
}

