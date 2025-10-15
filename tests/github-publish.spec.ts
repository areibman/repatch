import { expect, test } from "@playwright/test";

type PatchNoteRow = {
  id: string;
  repo_name: string;
  repo_url: string;
  time_period: "1day" | "1week" | "1month";
  generated_at: string;
  title: string;
  content: string;
  changes: { added: number; modified: number; removed: number };
  contributors: string[];
  video_data: unknown;
  video_url: string | null;
  ai_summaries: unknown;
  ai_overall_summary: string | null;
  github_publish_status: "idle" | "publishing" | "published" | "failed";
  github_publish_target: "release" | "discussion" | null;
  github_release_id: string | null;
  github_release_url: string | null;
  github_discussion_id: string | null;
  github_discussion_url: string | null;
  github_publish_attempted_at: string | null;
  github_publish_completed_at: string | null;
  github_publish_error: string | null;
  created_at: string;
  updated_at: string;
};

const basePatchNote = (id: string): PatchNoteRow => ({
  id,
  repo_name: "openai/repatch",
  repo_url: "https://github.com/openai/repatch",
  time_period: "1week",
  generated_at: new Date("2025-01-06T00:00:00Z").toISOString(),
  title: "Weekly changelog",
  content: "## Updates\n- Added release publishing",
  changes: { added: 120, modified: 34, removed: 12 },
  contributors: ["octocat"],
  video_data: null,
  video_url: null,
  ai_summaries: null,
  ai_overall_summary: null,
  github_publish_status: "idle",
  github_publish_target: null,
  github_release_id: null,
  github_release_url: null,
  github_discussion_id: null,
  github_discussion_url: null,
  github_publish_attempted_at: null,
  github_publish_completed_at: null,
  github_publish_error: null,
  created_at: new Date("2025-01-06T00:00:00Z").toISOString(),
  updated_at: new Date("2025-01-06T00:00:00Z").toISOString(),
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/videos/status/**", async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ hasVideo: false }),
      headers: { "content-type": "application/json" },
    });
  });
});

test("publishes a patch note to GitHub releases", async ({ page }) => {
  const patchNoteId = "test-note";
  const patchNoteRow = basePatchNote(patchNoteId);

  await page.route(`**/api/patch-notes/${patchNoteId}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(patchNoteRow),
        headers: { "content-type": "application/json" },
      });
      return;
    }
    await route.continue();
  });

  let publishCalled = false;

  await page.route(
    `**/api/patch-notes/${patchNoteId}/publish`,
    async (route) => {
      publishCalled = true;
      const payload = route.request().postDataJSON() as { target: string };
      expect(payload.target).toBe("release");

      const updatedRow: PatchNoteRow = {
        ...patchNoteRow,
        github_publish_status: "published",
        github_publish_target: "release",
        github_release_id: "999",
        github_release_url: "https://github.com/openai/repatch/releases/tag/repatch-test",
        github_publish_attempted_at: new Date().toISOString(),
        github_publish_completed_at: new Date().toISOString(),
        github_publish_error: null,
      };

      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          ok: true,
          target: "release",
          url: updatedRow.github_release_url,
          patchNote: updatedRow,
        }),
        headers: { "content-type": "application/json" },
      });
    }
  );

  await page.goto(`/blog/${patchNoteId}`);

  await expect(page.getByTestId("github-publish-status")).toHaveText(
    "Not Published"
  );

  await page.getByTestId("publish-release-button").click();

  await expect(page.getByTestId("github-publish-status")).toHaveText(
    "Published"
  );
  await expect(page.getByTestId("github-release-link")).toHaveAttribute(
    "href",
    "https://github.com/openai/repatch/releases/tag/repatch-test"
  );
  await expect(page.getByTestId("github-publish-feedback")).toContainText(
    "Published to GitHub Releases successfully."
  );
  expect(publishCalled).toBe(true);
});

test("surfaces GitHub publish failures", async ({ page }) => {
  const patchNoteId = "failure-note";
  const patchNoteRow = basePatchNote(patchNoteId);

  await page.route(`**/api/patch-notes/${patchNoteId}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(patchNoteRow),
        headers: { "content-type": "application/json" },
      });
      return;
    }
    await route.continue();
  });

  await page.route(
    `**/api/patch-notes/${patchNoteId}/publish`,
    async (route) => {
      const payload = route.request().postDataJSON() as { target: string };
      expect(payload.target).toBe("discussion");

      await route.fulfill({
        status: 502,
        body: JSON.stringify({ error: "GitHub outage" }),
        headers: { "content-type": "application/json" },
      });
    }
  );

  await page.goto(`/blog/${patchNoteId}`);

  await expect(page.getByTestId("github-publish-status")).toHaveText(
    "Not Published"
  );

  await page.getByTestId("publish-discussion-button").click();

  await expect(page.getByTestId("github-publish-status")).toHaveText(
    "Publish Failed"
  );
  await expect(page.getByTestId("github-publish-error")).toContainText(
    "GitHub outage"
  );
});
