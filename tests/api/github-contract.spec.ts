import { expect, test } from "@playwright/test";

test.describe("GitHub API contract", () => {
  test("returns mocked branches when integrations are offline", async ({ request }) => {
    const response = await request.get("/api/github/branches?owner=mock&repo=demo");
    expect(response.ok()).toBeTruthy();
    const branches = (await response.json()) as Array<{ name: string; protected: boolean }>;
    expect(branches.length).toBeGreaterThan(0);
    expect(branches[0].name).toBe("main");
  });

  test("surfaces repository statistics from fixtures", async ({ request }) => {
    const response = await request.get(
      "/api/github/stats?owner=mock&repo=demo&timePeriod=1week"
    );
    expect(response.ok()).toBeTruthy();
    const stats = await response.json();
    expect(stats.commits).toBeGreaterThan(0);
    expect(stats.additions).toBeGreaterThan(0);
    expect(Array.isArray(stats.contributors)).toBeTruthy();
  });

  test("summarizes commits without live GitHub access", async ({ request }) => {
    const response = await request.post("/api/github/summarize", {
      data: {
        owner: "mock",
        repo: "demo",
        timePeriod: "1week",
      },
    });

    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.summaries.length).toBeGreaterThan(0);
    expect(payload.overallSummary).toBeTruthy();
  });
});
