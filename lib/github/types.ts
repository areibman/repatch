/**
 * GitHub API Type Definitions
 * Centralized type definitions for GitHub integration
 */

import type { PatchNoteFilters, TimePreset } from '@/types/patch-note';

/**
 * Core GitHub commit structure
 */
export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
  } | null;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

/**
 * Repository statistics aggregation
 */
export interface RepoStats {
  commits: number;
  additions: number;
  deletions: number;
  contributors: string[];
  commitMessages: string[];
}

/**
 * GitHub branch information
 */
export interface GitHubBranch {
  name: string;
  protected: boolean;
}

/**
 * GitHub tag information
 */
export interface GitHubTag {
  name: string;
  commitSha: string;
}

/**
 * GitHub release information
 */
export interface GitHubRelease {
  id: number;
  tagName: string;
  name: string | null;
  publishedAt: string | null;
  targetCommitish: string;
}

/**
 * Pull request details with comments
 */
export interface PullRequestDetails {
  title: string;
  body: string | null;
  comments: Array<{ author: string; body: string }>;
  issueNumber?: number;
  issueTitle?: string;
  issueBody?: string | null;
}

/**
 * Commit statistics
 */
export interface CommitStats {
  additions: number;
  deletions: number;
}

/**
 * Repository information parsed from URL
 */
export interface RepoInfo {
  owner: string;
  repo: string;
}

/**
 * Date range for filtering commits
 */
export interface DateRange {
  since: string;
  until: string;
}

/**
 * Re-export dependent types
 */
export type { PatchNoteFilters, TimePreset };

