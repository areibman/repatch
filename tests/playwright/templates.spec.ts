import { test, expect } from "@playwright/test";
import {
  resolveTemplate,
  generatePatchNoteContent,
  CommitSummary,
} from "@/lib/ai-summarizer";
import { formatPatchNoteContentFromSummaries } from "@/lib/patch-note-format";

test.describe("AI template utilities", () => {
  test("resolveTemplate merges defaults and trims examples", () => {
    const resolved = resolveTemplate({
      commitPrompt: "Focus on customer impact.",
      overallPrompt: "",
      exampleInput: "  Example input  ",
      exampleOutput: "Example output \n",
    });

    expect(resolved.commitPrompt).toBe("Focus on customer impact.");
    expect(resolved.overallPrompt).toContain("## Key Changes");
    expect(resolved.exampleInput).toBe("Example input");
    expect(resolved.exampleOutput).toBe("Example output");
  });

  test("formatPatchNoteContentFromSummaries persists markdown layout", () => {
    const content = formatPatchNoteContentFromSummaries(
      "Quick summary of work",
      [
        {
          message: "feat: add login",
          aiSummary: "Adds a passwordless login path for admins.",
          additions: 24,
          deletions: 2,
        },
      ],
      "Fallback copy"
    );

    expect(content).toContain("Quick summary of work");
    expect(content).toContain("## Key Changes");
    expect(content).toContain("### feat: add login");
    expect(content).toContain("Adds a passwordless login path for admins.");
  });

  test("formatPatchNoteContentFromSummaries falls back when no overall summary", () => {
    const content = formatPatchNoteContentFromSummaries(
      null,
      [
        {
          message: "fix: patch",
          aiSummary: "Fixes regression.",
          additions: 1,
          deletions: 1,
        },
      ],
      "Existing patch note content"
    );

    expect(content).toBe("Existing patch note content");
  });

  test("generatePatchNoteContent returns deterministic text without API keys", async () => {
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const summaries: CommitSummary[] = [
      {
        sha: "abc123",
        message: "feat: onboarding checklist",
        aiSummary: "Introduces an onboarding checklist for new workspaces.",
        additions: 42,
        deletions: 3,
      },
    ];

    const output = await generatePatchNoteContent({
      repoName: "acme/repo",
      timePeriod: "1week",
      commitSummaries: summaries,
      totalCommits: 3,
      totalAdditions: 120,
      totalDeletions: 30,
    });

    expect(output).toContain("acme/repo");
    expect(output).toContain("Introduces an onboarding checklist for new workspaces.");
    expect(output).toMatch(/1\.\s/);
  });
});
