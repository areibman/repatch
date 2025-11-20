/**
 * GitHub API Layer
 * Pure business logic separated from HTTP concerns
 */

import {
  fetchGitHubBranches,
  fetchGitHubLabels,
  fetchGitHubReleases,
  fetchGitHubTags,
} from '@/lib/github';
import { fetchGitHubStats, summarizeCommits, type FetchGitHubStatsInput } from '@/lib/services';
import type { ServiceResult } from '@/lib/services/github-stats.service';

/**
 * List branches for a repository
 */
export async function listBranches(
  owner: string,
  repo: string
): Promise<ServiceResult<unknown[]>> {
  try {
    const branches = await fetchGitHubBranches(owner, repo);
    return { success: true, data: branches };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch branches',
    };
  }
}

/**
 * List labels for a repository
 */
export async function listLabels(
  owner: string,
  repo: string
): Promise<ServiceResult<unknown[]>> {
  try {
    const labels = await fetchGitHubLabels(owner, repo);
    return { success: true, data: labels };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch labels',
    };
  }
}

/**
 * List releases for a repository
 */
export async function listReleases(
  owner: string,
  repo: string
): Promise<ServiceResult<unknown[]>> {
  try {
    const releases = await fetchGitHubReleases(owner, repo);
    return { success: true, data: releases };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch releases',
    };
  }
}

/**
 * List tags for a repository
 */
export async function listTags(
  owner: string,
  repo: string
): Promise<ServiceResult<unknown[]>> {
  try {
    const tags = await fetchGitHubTags(owner, repo);
    return { success: true, data: tags };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tags',
    };
  }
}

/**
 * Get repository statistics
 */
export async function getStats(
  owner: string,
  repo: string,
  input: Omit<FetchGitHubStatsInput, 'owner' | 'repo'>
): Promise<ServiceResult<unknown>> {
  return fetchGitHubStats({ owner, repo, ...input });
}

/**
 * Summarize commits with AI
 * Note: This is now a job-based operation
 */
export { summarizeCommits };
