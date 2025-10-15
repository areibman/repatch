import { test, expect, Page } from "@playwright/test";

type PatchNoteResponse = ReturnType<typeof createPatchNoteResponse>;

function createPatchNoteResponse(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    id: "note-1",
    repo_name: "openai/repatch",
    repo_url: "https://github.com/openai/repatch",
    time_period: "1week",
    generated_at: "2025-01-01T00:00:00Z",
    title: "Weekly summary",
    content: "## Updates\n- Added new features",
    changes: { added: 5, modified: 3, removed: 1 },
    contributors: ["@octocat"],
    video_url: null,
    video_data: null,
    github_publish_status: "idle",
    github_publish_target: null,
    github_publish_error: null,
    github_release_id: null,
    github_release_url: null,
    github_release_tag: null,
    github_discussion_id: null,
    github_discussion_url: null,
    github_discussion_category_slug: null,
    github_publish_attempts: 0,
    github_last_published_at: null,
    github_publish_next_retry_at: null,
    ...overrides,
  };
}

async function mockPatchNoteRoutes(page: Page, response: PatchNoteResponse) {
  await page.route("**/api/patch-notes/note-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  await page.route("**/api/videos/status/note-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hasVideo: false }),
    });
  });
}

test.describe("GitHub publishing", () => {
  test("publishes a patch note as a GitHub release", async ({ page }) => {
    await mockPatchNoteRoutes(page, createPatchNoteResponse());

    await page.route("**/api/patch-notes/note-1/publish", async (route) => {
      const request = route.request();
      const body = await request.postDataJSON();
      expect(body).toEqual({ target: "release", tagName: "v1.2.3" });

      const responseBody = createPatchNoteResponse({
        github_publish_status: "published",
        github_publish_target: "release",
        github_release_id: "999",
        github_release_url:
          "https://github.com/openai/repatch/releases/tag/v1.2.3",
        github_release_tag: "v1.2.3",
        github_publish_attempts: 1,
        github_last_published_at: "2025-01-05T12:00:00Z",
      });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responseBody),
      });
    });

    await page.goto("/blog/note-1");
    await page.getByTestId("github-tag-input").fill("v1.2.3");
    await page.getByTestId("github-publish-button").click();

    await expect(page.getByTestId("github-status-badge")).toContainText(
      "Published"
    );
    await expect(page.getByTestId("github-release-link")).toHaveAttribute(
      "href",
      /releases/
    );
    await expect(page.getByTestId("github-last-published")).toBeVisible();
  });

  test("handles GitHub publish failures and shows retry metadata", async ({
    page,
  }) => {
    await mockPatchNoteRoutes(page, createPatchNoteResponse());

    await page.route("**/api/patch-notes/note-1/publish", async (route) => {
      const responseBody = {
        error: "GitHub token missing",
        patchNote: createPatchNoteResponse({
          github_publish_status: "failed",
          github_publish_error: "GitHub token missing",
          github_publish_attempts: 2,
          github_publish_next_retry_at: "2025-01-06T09:30:00Z",
        }),
      };

      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify(responseBody),
      });
    });

    await page.goto("/blog/note-1");
    await page.getByTestId("github-target-select").click();
    await page.getByRole("option", { name: "Discussion" }).click();
    await page.getByTestId("github-discussion-input").fill("engineering");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("github-publish-button").click();

    await expect(page.getByTestId("github-status-badge")).toContainText(
      "Failed"
    );
    await expect(page.getByTestId("github-error")).toContainText(
      "GitHub token missing"
    );
    await expect(page.getByTestId("github-next-retry")).toBeVisible();
  });
});
