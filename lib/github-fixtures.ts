import type { GitHubCommit, RepoStats } from "./github";

type CommitStats = Record<string, { additions: number; deletions: number }>; 

type FixturePayload = {
  branches: Array<{ name: string; protected: boolean }>;
  commits: GitHubCommit[];
  stats: CommitStats;
  diffs: Record<string, string>;
};

const fixture: FixturePayload = {
  branches: [
    { name: "main", protected: true },
    { name: "develop", protected: false },
    { name: "docs", protected: false },
  ],
  commits: [
    {
      sha: "1111111",
      commit: {
        author: { name: "Alice Example", date: new Date("2024-12-01T12:00:00Z").toISOString() },
        message: "feat: add onboarding checklist",
      },
      author: { login: "alice" },
    },
    {
      sha: "2222222",
      commit: {
        author: { name: "Bob Example", date: new Date("2024-12-02T12:00:00Z").toISOString() },
        message: "fix: repair failing build step",
      },
      author: { login: "bob" },
    },
    {
      sha: "3333333",
      commit: {
        author: { name: "Carol Example", date: new Date("2024-12-03T12:00:00Z").toISOString() },
        message: "docs: refresh integration guide",
      },
      author: { login: "carol" },
    },
  ],
  stats: {
    "1111111": { additions: 420, deletions: 12 },
    "2222222": { additions: 85, deletions: 30 },
    "3333333": { additions: 140, deletions: 10 },
  },
  diffs: {
    "1111111": "diff --git a/app/page.tsx b/app/page.tsx\n+// new onboarding checklist\n",
    "2222222": "diff --git a/.github/workflows/test.yml b/.github/workflows/test.yml\n-# failing step\n",
    "3333333": "diff --git a/docs/README.md b/docs/README.md\n+Updated documentation\n",
  },
};

export function getFixtureBranches() {
  return fixture.branches;
}

export function getFixtureCommits(): GitHubCommit[] {
  return fixture.commits;
}

export function getFixtureCommitStats(): CommitStats {
  return fixture.stats;
}

export function getFixtureDiff(sha: string): string {
  return fixture.diffs[sha] ?? "";
}

export function toRepoStats(): RepoStats {
  const additions = Object.values(fixture.stats).reduce((sum, value) => sum + value.additions, 0);
  const deletions = Object.values(fixture.stats).reduce((sum, value) => sum + value.deletions, 0);
  return {
    commits: fixture.commits.length,
    additions,
    deletions,
    contributors: Array.from(new Set(fixture.commits.map((commit) => `@${commit.author?.login ?? commit.commit.author.name}`))),
    commitMessages: fixture.commits.map((commit) => commit.commit.message),
  };
}
