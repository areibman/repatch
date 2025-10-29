/**
 * GitHub Repository Statistics
 * Functions for aggregating repository statistics from commits
 */

import type { PatchNoteFilters } from '../types/patch-note';
import { getCommitsForFilters, fetchCommitStats } from './commits';
import {
  formatFilterSummary,
  formatFilterDetailLabel,
  getPresetLabel,
} from '../filter-utils';

export interface RepoStats {
  commits: number;
  additions: number;
  deletions: number;
  contributors: string[];
  commitMessages: string[];
}

/**
 * Aggregate repository statistics from commits
 */
export async function getRepoStats(
  owner: string,
  repo: string,
  filters?: PatchNoteFilters,
  branch?: string
): Promise<RepoStats> {
  const commits = await getCommitsForFilters(owner, repo, filters, branch);

  if (commits.length === 0) {
    return {
      commits: 0,
      additions: 0,
      deletions: 0,
      contributors: [],
      commitMessages: [],
    };
  }

  // Extract unique contributors
  const contributorSet = new Set<string>();
  const commitMessages: string[] = [];

  commits.forEach((commit) => {
    if (commit.author?.login) {
      contributorSet.add(`@${commit.author.login}`);
    } else if (commit.commit.author.name) {
      contributorSet.add(commit.commit.author.name);
    }
    commitMessages.push(commit.commit.message);
  });

  // Fetch detailed stats for up to 20 most recent commits
  // (to avoid rate limiting, we sample instead of fetching all)
  const commitsToFetch = commits.slice(0, Math.min(20, commits.length));
  const statsPromises = commitsToFetch.map((commit) =>
    fetchCommitStats(owner, repo, commit.sha)
  );

  const stats = await Promise.all(statsPromises);

  // Calculate totals
  const additions = stats.reduce((sum, s) => sum + s.additions, 0);
  const deletions = stats.reduce((sum, s) => sum + s.deletions, 0);

  // Estimate total changes if we didn't fetch all commits
  const estimationFactor = commits.length / commitsToFetch.length;
  const estimatedAdditions = Math.round(additions * estimationFactor);
  const estimatedDeletions = Math.round(deletions * estimationFactor);

  return {
    commits: commits.length,
    additions: estimatedAdditions,
    deletions: estimatedDeletions,
    contributors: Array.from(contributorSet),
    commitMessages,
  };
}

/**
 * Generate boilerplate patch note content
 */
export function generateBoilerplateContent(
  repoName: string,
  filters: PatchNoteFilters | undefined,
  stats: RepoStats
): string {
  const descriptor =
    filters?.mode === 'preset' && filters.preset
      ? getPresetLabel(filters.preset)
      : filters?.mode === 'release'
      ? 'Release Selection'
      : 'Custom Range';
  const detailLabel = filters
    ? formatFilterDetailLabel(filters)
    : getPresetLabel('1week');

  const content = `# ${descriptor} Update for ${repoName}

## 📊 Overview

This summary covers changes made to the repository for ${detailLabel}.

**Period Statistics:**
- **${stats.commits}** commits
- **${stats.contributors.length}** active contributors
- **${stats.additions.toLocaleString()}** lines added
- **${stats.deletions.toLocaleString()}** lines removed

## 🚀 Highlights

${
    stats.commits > 0
      ? `
The team has been actively developing with ${stats.commits} commits during this timeframe.
Key areas of focus include ongoing development and improvements across the codebase.
`
      : 'No commits were made during this period.'
  }

## 📝 Recent Commits

${stats.commitMessages
    .slice(0, 10)
    .map((msg) => `- ${msg.split('\n')[0]}`)
    .join('\n')}

${
    stats.commitMessages.length > 10
      ? `\n_...and ${stats.commitMessages.length - 10} more commits_`
      : ''
  }

## 👥 Contributors

Thanks to all contributors who made this release possible:
${stats.contributors.join(', ')}

---

*Note: This is an auto-generated summary. AI-powered detailed analysis coming soon.*
`;

  return content;
}
