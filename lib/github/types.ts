/**
 * GitHub API types and interfaces
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

export interface RepoStats {
  commits: number;
  additions: number;
  deletions: number;
  contributors: string[];
  commitMessages: string[];
}

export interface GitHubTag {
  name: string;
  commitSha: string;
}

export interface GitHubRelease {
  id: number;
  tagName: string;
  name: string | null;
  publishedAt: string | null;
  targetCommitish: string;
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
}

export interface GitHubLabel {
  name: string;
  color?: string;
  description?: string;
}

export interface PullRequestDetails {
  title: string;
  body: string | null;
  comments: Array<{ author: string; body: string }>;
  issueNumber?: number;
  issueTitle?: string;
  issueBody?: string | null;
}

export interface CommitStats {
  additions: number;
  deletions: number;
}
