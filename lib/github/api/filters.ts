/**
 * GitHub API Filtering Functions
 * Functions for filtering commits based on tags, labels, and releases
 */

import { normalizeFilters } from '@/lib/filter-utils';
import type { PatchNoteFilters, GitHubCommit } from '../types';
import { fetchGitHubTags } from './repository';
import { fetchCommitLabels, fetchCommitsBetweenRefs, fetchCommitsByTag, fetchGitHubCommits, getDateRange } from './commits';

/**
 * Collect commits for multiple releases
 */
async function collectCommitsForReleases(
  owner: string,
  repo: string,
  releases: NonNullable<PatchNoteFilters['releases']>
): Promise<GitHubCommit[]> {
  const commitsBySha = new Map<string, GitHubCommit>();

  for (const release of releases) {
    if (!release?.tag) continue;

    try {
      let releaseCommits: GitHubCommit[] = [];

      if (release.previousTag) {
        // Compare between tags
        releaseCommits = await fetchCommitsBetweenRefs(
          owner,
          repo,
          release.previousTag,
          release.tag
        );
      } else if (release.publishedAt) {
        // Use time-based filtering
        const until = new Date(release.publishedAt).toISOString();
        const sinceDate = new Date(release.publishedAt);
        sinceDate.setDate(sinceDate.getDate() - 30);
        const targetBranch = release.targetCommitish?.trim() || undefined;
        releaseCommits = await fetchGitHubCommits(
          owner,
          repo,
          sinceDate.toISOString(),
          until,
          targetBranch
        );
      } else {
        // Fetch by tag
        releaseCommits = await fetchCommitsByTag(owner, repo, release.tag);
      }

      // Deduplicate commits
      releaseCommits.forEach(commit => {
        if (!commitsBySha.has(commit.sha)) {
          commitsBySha.set(commit.sha, commit);
        }
      });
    } catch (error) {
      console.warn(`Skipping release ${release.tag} due to error:`, error);
    }
  }

  // Sort by date, newest first
  return Array.from(commitsBySha.values()).sort((a, b) => {
    const aDate = new Date(a.commit.author.date).getTime();
    const bDate = new Date(b.commit.author.date).getTime();
    return bDate - aDate;
  });
}

/**
 * Filter commits by labels (include/exclude)
 */
async function filterCommitsByLabels(
  owner: string,
  repo: string,
  commits: GitHubCommit[],
  includeLabels: string[],
  excludeLabels: string[]
): Promise<GitHubCommit[]> {
  const filtered: GitHubCommit[] = [];

  for (const commit of commits) {
    const labels = await fetchCommitLabels(owner, repo, commit.sha);

    // Check include labels
    if (includeLabels.length > 0) {
      const hasInclude = labels.some(label => includeLabels.includes(label));
      if (!hasInclude) {
        continue;
      }
    }

    // Check exclude labels
    if (excludeLabels.length > 0) {
      const hasExclude = labels.some(label => excludeLabels.includes(label));
      if (hasExclude) {
        continue;
      }
    }

    filtered.push(commit);
  }

  return filtered;
}

/**
 * Get commits for the given filters
 * Main entry point for filtered commit retrieval
 */
export async function getCommitsForFilters(
  owner: string,
  repo: string,
  filters?: PatchNoteFilters,
  branch?: string
): Promise<GitHubCommit[]> {
  const effectiveFilters = normalizeFilters(filters);

  let commits: GitHubCommit[] = [];

  // Handle release mode
  if (
    effectiveFilters.mode === 'release' &&
    effectiveFilters.releases &&
    effectiveFilters.releases.length > 0
  ) {
    commits = await collectCommitsForReleases(
      owner,
      repo,
      effectiveFilters.releases
    );
  } else {
    // Handle time-based filtering (preset or custom)
    let since: string;
    let until: string;

    if (
      effectiveFilters.mode === 'custom' &&
      effectiveFilters.customRange?.since &&
      effectiveFilters.customRange?.until
    ) {
      since = new Date(effectiveFilters.customRange.since).toISOString();
      until = new Date(effectiveFilters.customRange.until).toISOString();
    } else {
      const preset =
        effectiveFilters.preset &&
        ['1day', '1week', '1month'].includes(effectiveFilters.preset)
          ? effectiveFilters.preset
          : '1week';
      const range = getDateRange(preset);
      since = range.since;
      until = range.until;
    }

    commits = await fetchGitHubCommits(owner, repo, since, until, branch);
  }

  // Apply tag filters
  const includeTags = effectiveFilters.includeTags ?? [];
  const excludeTags = effectiveFilters.excludeTags ?? [];
  if (includeTags.length > 0 || excludeTags.length > 0) {
    const tags = await fetchGitHubTags(owner, repo);
    const tagMap = new Map<string, string[]>();
    tags.forEach(tag => {
      const current = tagMap.get(tag.commitSha) ?? [];
      current.push(tag.name);
      tagMap.set(tag.commitSha, current);
    });

    commits = commits.filter(commit => {
      const commitTags = tagMap.get(commit.sha) ?? [];
      if (
        includeTags.length > 0 &&
        !commitTags.some(tag => includeTags.includes(tag))
      ) {
        return false;
      }
      if (
        excludeTags.length > 0 &&
        commitTags.some(tag => excludeTags.includes(tag))
      ) {
        return false;
      }
      return true;
    });
  }

  // Apply label filters
  const includeLabels = effectiveFilters.includeLabels ?? [];
  const excludeLabels = effectiveFilters.excludeLabels ?? [];
  if (includeLabels.length > 0 || excludeLabels.length > 0) {
    commits = await filterCommitsByLabels(
      owner,
      repo,
      commits,
      includeLabels,
      excludeLabels
    );
  }

  return commits;
}

