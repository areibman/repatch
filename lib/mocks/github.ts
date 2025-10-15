import type { GitHubCommit, RepoStats } from "@/lib/github";

type MockCommit = GitHubCommit & {
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
  diff: string;
};

const MOCK_COMMITS: MockCommit[] = [
  {
    sha: "mock-sha-1",
    commit: {
      author: { name: "Alice Example", date: new Date().toISOString() },
      message: "feat: add onboarding checklist to dashboard\n\nIntroduces guided steps for new maintainers.",
    },
    author: { login: "alice" },
    stats: { additions: 142, deletions: 12, total: 154 },
    diff: "diff --git a/dashboard.tsx b/dashboard.tsx\n+ export const Checklist = () => {/* mock diff */}\n",
  },
  {
    sha: "mock-sha-2",
    commit: {
      author: { name: "Bob Example", date: new Date().toISOString() },
      message: "fix: resolve webhook retry bug\n\nEnsures exponential backoff stops after success.",
    },
    author: { login: "bob" },
    stats: { additions: 58, deletions: 21, total: 79 },
    diff: "diff --git a/webhooks.ts b/webhooks.ts\n- retryForever()\n+ retryWithBackoff()\n",
  },
  {
    sha: "mock-sha-3",
    commit: {
      author: { name: "Carol Example", date: new Date().toISOString() },
      message: "chore: update dependencies\n\nBumps Supabase client and refresh token handling.",
    },
    author: { login: "carol" },
    stats: { additions: 23, deletions: 8, total: 31 },
    diff: "diff --git a/package.json b/package.json\n- \"@supabase/supabase-js\": \"^2.57.0\"\n+ \"@supabase/supabase-js\": \"^2.58.0\"\n",
  },
];

const MOCK_BRANCHES = [
  { name: "main", protected: true },
  { name: "develop", protected: false },
  { name: "chore/content-refresh", protected: false },
];

export function getMockBranches(): { name: string; protected: boolean }[] {
  return MOCK_BRANCHES;
}

export function getMockCommits(): GitHubCommit[] {
  return MOCK_COMMITS.map(({ diff: _diff, stats, ...commit }) => ({
    ...commit,
    stats,
  }));
}

export function getMockCommitStats(
  sha: string
): { additions: number; deletions: number } {
  const commit = MOCK_COMMITS.find((item) => item.sha === sha);
  if (!commit) {
    return { additions: 0, deletions: 0 };
  }
  return {
    additions: commit.stats.additions,
    deletions: commit.stats.deletions,
  };
}

export function getMockCommitDiff(sha: string): string {
  const commit = MOCK_COMMITS.find((item) => item.sha === sha);
  return commit?.diff ?? "";
}

export function getMockRepoStats(): RepoStats {
  const additions = MOCK_COMMITS.reduce(
    (sum, commit) => sum + commit.stats.additions,
    0
  );
  const deletions = MOCK_COMMITS.reduce(
    (sum, commit) => sum + commit.stats.deletions,
    0
  );
  const contributors = Array.from(
    new Set(
      MOCK_COMMITS.map((commit) =>
        commit.author?.login ? `@${commit.author.login}` : commit.commit.author.name
      )
    )
  );

  return {
    commits: MOCK_COMMITS.length,
    additions,
    deletions,
    contributors,
    commitMessages: MOCK_COMMITS.map((commit) => commit.commit.message),
  };
}
