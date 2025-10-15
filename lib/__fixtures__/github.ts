import type { GitHubCommit, RepoStats } from "@/lib/github";

export const mockBranches = [
  { name: "main", protected: true },
  { name: "develop", protected: false },
  { name: "preview", protected: false },
];

export const mockCommits: GitHubCommit[] = [
  {
    sha: "aaaa1111",
    commit: {
      author: { name: "Alice", date: new Date("2025-10-03T10:00:00Z").toISOString() },
      message: "feat: launch collaboration dashboard\n\nAdds shared workspace UI",
    },
    author: { login: "alice" },
    stats: { additions: 820, deletions: 120, total: 940 },
  },
  {
    sha: "bbbb2222",
    commit: {
      author: { name: "Bob", date: new Date("2025-10-02T15:30:00Z").toISOString() },
      message: "fix: tighten rate limiter\n\nPrevents abuse on free tier",
    },
    author: { login: "bob" },
    stats: { additions: 120, deletions: 50, total: 170 },
  },
  {
    sha: "cccc3333",
    commit: {
      author: { name: "Carol", date: new Date("2025-10-01T09:45:00Z").toISOString() },
      message: "chore: dependency upgrades",
    },
    author: { login: "carol" },
    stats: { additions: 45, deletions: 20, total: 65 },
  },
];

export const mockCommitStats: Record<string, { additions: number; deletions: number }> = {
  aaaa1111: { additions: 820, deletions: 120 },
  bbbb2222: { additions: 120, deletions: 50 },
  cccc3333: { additions: 45, deletions: 20 },
};

export const mockCommitDiff: Record<string, string> = {
  aaaa1111: "diff --git a/dashboard.tsx b/dashboard.tsx",
  bbbb2222: "diff --git a/rate-limiter.ts b/rate-limiter.ts",
  cccc3333: "diff --git a/package.json b/package.json",
};

export const mockRepoStats: RepoStats = {
  commits: mockCommits.length,
  additions: mockCommits.reduce((sum, commit) => sum + (commit.stats?.additions ?? 0), 0),
  deletions: mockCommits.reduce((sum, commit) => sum + (commit.stats?.deletions ?? 0), 0),
  contributors: Array.from(new Set(mockCommits.map((commit) => `@${commit.author?.login ?? commit.commit.author.name}`))),
  commitMessages: mockCommits.map((commit) => commit.commit.message),
};

export function getMockRepoStats(): RepoStats {
  return { ...mockRepoStats, contributors: [...mockRepoStats.contributors], commitMessages: [...mockRepoStats.commitMessages] };
}
