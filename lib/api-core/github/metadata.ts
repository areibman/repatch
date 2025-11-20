/**
 * Unified GitHub metadata operations
 */

import { 
  fetchGitHubBranches, 
  fetchGitHubLabels, 
  fetchGitHubReleases, 
  fetchGitHubTags 
} from '@/lib/github';
import type { Result } from '../types/result';
import { success, error } from '../types/result';

export interface GitHubMetadataInput {
  readonly owner: string;
  readonly repo: string;
  readonly include?: readonly ('branches' | 'labels' | 'releases' | 'tags')[];
}

export interface GitHubMetadataResult {
  readonly branches?: unknown[];
  readonly labels?: unknown[];
  readonly releases?: unknown[];
  readonly tags?: unknown[];
}

/**
 * Get unified GitHub metadata
 * Fetches multiple types of repository metadata in a single operation
 */
export async function getGitHubMetadata(
  input: GitHubMetadataInput
): Promise<Result<GitHubMetadataResult>> {
  try {
    const { owner, repo, include = ['branches', 'labels', 'releases', 'tags'] } = input;

    // Fetch all requested metadata in parallel
    const results = await Promise.allSettled([
      include.includes('branches') ? fetchGitHubBranches(owner, repo) : Promise.resolve(null),
      include.includes('labels') ? fetchGitHubLabels(owner, repo) : Promise.resolve(null),
      include.includes('releases') ? fetchGitHubReleases(owner, repo) : Promise.resolve(null),
      include.includes('tags') ? fetchGitHubTags(owner, repo) : Promise.resolve(null),
    ]);

    const metadata: GitHubMetadataResult = {};

    // Extract results
    if (include.includes('branches') && results[0].status === 'fulfilled') {
      metadata.branches = results[0].value || [];
    }
    if (include.includes('labels') && results[1].status === 'fulfilled') {
      metadata.labels = results[1].value || [];
    }
    if (include.includes('releases') && results[2].status === 'fulfilled') {
      metadata.releases = results[2].value || [];
    }
    if (include.includes('tags') && results[3].status === 'fulfilled') {
      metadata.tags = results[3].value || [];
    }

    return success(metadata);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Failed to fetch GitHub metadata');
  }
}
