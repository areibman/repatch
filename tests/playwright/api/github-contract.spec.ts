import { expect, test } from "@playwright/test";

test.describe("GitHub API fixtures", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/test-utils/reset", {
      data: {
        supabase: {
          patch_notes: [],
          email_subscribers: [],
          github_configs: [],
        },
        resend: {
          contacts: [],
        },
      },
    });
  });

  test("returns fixture branches", async ({ request }) => {
    const response = await request.get("/api/github/branches?owner=acme&repo=awesome-project");
    expect(response.ok()).toBeTruthy();
    const branches = await response.json();
    expect(branches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "main" }),
      ])
    );
  });

  test("calculates repository stats offline", async ({ request }) => {
    const response = await request.get(
      "/api/github/stats?owner=acme&repo=awesome-project&timePeriod=1week"
    );
    expect(response.ok()).toBeTruthy();
    const stats = await response.json();
    expect(stats.commits).toBeGreaterThan(0);
    expect(stats.additions).toBeGreaterThan(stats.deletions);
    expect(stats.contributors).toEqual(expect.arrayContaining(["@alice", "@bob", "@carol"]));
  });

  test("summarizes commits using fixtures", async ({ request }) => {
    const response = await request.post("/api/github/summarize", {
      data: {
        owner: "acme",
        repo: "awesome-project",
        timePeriod: "1week",
      },
    });

    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.totalCommits).toBeGreaterThan(0);
    expect(Array.isArray(payload.summaries)).toBe(true);
    expect(payload.summaries.length).toBeGreaterThan(0);
    expect(typeof payload.overallSummary).toBe("string");
  });
});
