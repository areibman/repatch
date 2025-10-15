import { test, expect } from "@playwright/test";

const buildPatchNotes = () => {
  const now = new Date().toISOString();

  return [
    {
      id: "patch-1",
      repo_name: "openai/repatch",
      repo_url: "https://github.com/openai/repatch",
      time_period: "1week" as const,
      generated_at: now,
      title: "Weekly Digest - Repatch",
      content: "- Added new AI summaries\n- Improved video pipeline",
      changes: { added: 420, modified: 0, removed: 120 },
      contributors: ["alice", "bob"],
      video_url: null,
      video_data: {
        langCode: "en",
        topChanges: [
          { title: "AI summaries", description: "Automated commit digests" },
        ],
        allChanges: ["Changelog entry"],
      },
    },
    {
      id: "patch-2",
      repo_name: "openai/repatch",
      repo_url: "https://github.com/openai/repatch",
      time_period: "1day" as const,
      generated_at: now,
      title: "Daily Snapshot - Repatch",
      content: "- Fixed subscription metrics\n- Added new contributors",
      changes: { added: 75, modified: 0, removed: 15 },
      contributors: ["carol"],
      video_url: "/videos/patch-2.mp4",
      video_data: null,
    },
  ];
};

test("shows patch notes overview and navigates to detail", async ({ page }) => {
  const patchNotes = buildPatchNotes();
  const detail = {
    ...patchNotes[0],
    video_url: "/videos/patch-1.mp4",
  };

  await page.route("**/api/patch-notes", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(patchNotes) })
  );
  await page.route("**/api/patch-notes/patch-1", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(detail) })
  );
  await page.route("**/api/videos/status/patch-1", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ hasVideo: true, videoUrl: detail.video_url }) })
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Repatch" })).toBeVisible();
  await expect(page.getByTestId("total-posts")).toHaveText("2");
  await expect(page.getByTestId("repository-count")).toHaveText("1");
  await expect(page.getByTestId("posts-this-month")).toHaveText("2");

  await expect(
    page.getByRole("link", { name: /Weekly Digest - Repatch/i })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Daily Snapshot - Repatch/i })
  ).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/blog\/patch-1$/),
    page.getByRole("link", { name: /Weekly Digest - Repatch/i }).click(),
  ]);

  await expect(
    page.getByRole("heading", { name: detail.title, level: 1 })
  ).toBeVisible();
});

test("creates a patch note via the dialog", async ({ page }) => {
  const patchNotes = buildPatchNotes();
  const statsResponse = {
    additions: 512,
    deletions: 128,
    contributors: ["alice", "bob", "carol"],
  };
  const summarizeResponse = {
    summaries: [
      {
        message: "feat: add dashboard",
        aiSummary: "Introduced a rich dashboard for release metrics.",
        additions: 320,
        deletions: 64,
      },
    ],
    overallSummary:
      "A productive week with a brand new dashboard and contributor highlights.",
  };
  const createdPatchNote = {
    id: "patch-3",
    repo_name: "openai/repatch",
    repo_url: "https://github.com/openai/repatch",
    time_period: "1week",
    generated_at: new Date().toISOString(),
    title: "Weekly Update - repatch",
    content: "Generated content",
    changes: { added: statsResponse.additions, modified: 0, removed: statsResponse.deletions },
    contributors: statsResponse.contributors,
    video_url: null,
    video_data: {
      langCode: "en",
      topChanges: summarizeResponse.summaries.map((summary) => ({
        title: summary.message,
        description: summary.aiSummary,
      })),
      allChanges: summarizeResponse.summaries.map((summary) => summary.aiSummary),
    },
  };

  await page.route("**/api/patch-notes", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ status: 200, body: JSON.stringify(patchNotes) });
      return;
    }

    if (method === "POST") {
      const body = route.request().postDataJSON() as any;
      expect(body.repo_name).toBe("openai/repatch");
      expect(body.branch).toBeUndefined();
      expect(body.time_period).toBe("1week");
      await route.fulfill({ status: 201, body: JSON.stringify(createdPatchNote) });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/github/branches**", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify([
        { name: "main", protected: true },
        { name: "develop", protected: false },
      ]),
    })
  );

  await page.route("**/api/github/stats**", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(statsResponse) })
  );

  await page.route("**/api/github/summarize", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(summarizeResponse) })
  );

  await page.route("**/api/patch-notes/patch-3", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(createdPatchNote) })
  );

  await page.route("**/api/videos/status/patch-3", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ hasVideo: false }) })
  );

  await page.goto("/");

  await page.getByRole("button", { name: "Create New Post" }).click();

  await page.getByLabel("Repository URL").fill(
    "https://github.com/openai/repatch"
  );

  await expect(
    page.getByRole("button", { name: /main 🔒/i })
  ).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/blog\/patch-3$/),
    (async () => {
      await page.getByTestId("create-patch-note-submit").click();
      await expect(page.getByTestId("create-patch-note-submit")).toContainText(
        "📊 Fetching repository statistics..."
      );
    })(),
  ]);

  await expect(
    page.getByRole("heading", { name: createdPatchNote.title, level: 1 })
  ).toBeVisible();
});
