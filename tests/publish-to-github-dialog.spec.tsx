import React from "react";
import { expect, test } from "@playwright/experimental-ct-react";

import { PublishToGitHubDialog } from "@/components/publish-to-github-dialog";
import { GitHubPublishStatus } from "@/components/github-publish-status";
import { PatchNote } from "@/types/patch-note";

function createPatchNote(): PatchNote {
  return {
    id: "note-1",
    repoName: "octocat/hello-world",
    repoUrl: "https://github.com/octocat/hello-world",
    timePeriod: "1week",
    generatedAt: new Date("2025-01-01T00:00:00.000Z"),
    title: "Weekly Update",
    content: "## Summary\n\nUpdates go here.",
    changes: {
      added: 42,
      removed: 12,
      modified: 5,
    },
    contributors: ["@octocat"],
    videoData: undefined,
    videoUrl: null,
    githubPublishStatus: "idle",
    githubPublishTarget: null,
    githubPublishError: null,
    githubPublishedAt: null,
    githubRelease: null,
    githubDiscussion: null,
  };
}

function createPatchNoteRow(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: "note-1",
    repo_name: "octocat/hello-world",
    repo_url: "https://github.com/octocat/hello-world",
    time_period: "1week",
    title: "Weekly Update",
    content: "## Summary\n\nUpdates go here.",
    changes: {
      added: 42,
      removed: 12,
      modified: 5,
    },
    contributors: ["@octocat"],
    video_data: null,
    video_url: null,
    ai_summaries: null,
    ai_overall_summary: null,
    generated_at: "2025-01-01T00:00:00.000Z",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    github_release_id: null,
    github_release_url: null,
    github_discussion_id: null,
    github_discussion_url: null,
    github_publish_status: "idle",
    github_publish_target: null,
    github_publish_error: null,
    github_published_at: null,
    ...overrides,
  };
}

function Harness() {
  const [note, setNote] = React.useState<PatchNote>(createPatchNote());

  return (
    <div className="space-y-4">
      <PublishToGitHubDialog patchNote={note} onPatchNoteChange={setNote} />
      <GitHubPublishStatus patchNote={note} />
    </div>
  );
}

test.describe("PublishToGitHubDialog", () => {
  test("publishes a release and updates status", async ({ mount, page }) => {
    await page.route("**/api/patch-notes/*/publish", async (route, request) => {
      const body = await request.postDataJSON();
      expect(body.target).toBe("release");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "published",
          release: {
            id: 123,
            url: "https://github.com/octocat/hello-world/releases/tag/repatch-note",
          },
          discussion: null,
          error: null,
          patchNote: createPatchNoteRow({
            github_release_id: 123,
            github_release_url: "https://github.com/octocat/hello-world/releases/tag/repatch-note",
            github_publish_status: "published",
            github_publish_target: "release",
            github_published_at: "2025-01-02T00:00:00.000Z",
          }),
        }),
      });
    });

    const component = await mount(<Harness />);

    await component.getByRole("button", { name: "Publish to GitHub" }).click();
    await page.getByRole("button", { name: "Publish" }).click();

    await expect(component.getByTestId("github-publish-status")).toContainText(
      "Published"
    );
    await expect(component.getByRole("link", { name: "View release" })).toHaveAttribute(
      "href",
      "https://github.com/octocat/hello-world/releases/tag/repatch-note"
    );
  });

  test("surfaces server failures", async ({ mount, page }) => {
    await page.route("**/api/patch-notes/*/publish", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          status: "failed",
          release: null,
          discussion: null,
          error: "GitHub release creation failed",
          patchNote: createPatchNoteRow({
            github_publish_status: "failed",
            github_publish_target: "release",
            github_publish_error: "GitHub release creation failed",
          }),
        }),
      });
    });

    const component = await mount(<Harness />);

    await component.getByRole("button", { name: "Publish to GitHub" }).click();
    await page.getByRole("button", { name: "Publish" }).click();

    await expect(component.getByTestId("github-publish-status")).toContainText("Failed");
    await expect(component.getByTestId("github-publish-status")).toContainText(
      "GitHub release creation failed"
    );
    await expect(page.getByText("GitHub release creation failed")).toBeVisible();
  });

  test("requires a discussion category before posting discussions", async ({
    mount,
    page,
  }) => {
    let requestCount = 0;
    await page.route("**/api/patch-notes/*/publish", async (route) => {
      requestCount += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    const component = await mount(<Harness />);

    await component.getByRole("button", { name: "Publish to GitHub" }).click();
    await page.getByLabel("Discussion").check();
    await page.getByRole("button", { name: "Publish" }).click();

    await expect(
      page.getByText("Select or provide a discussion category name.")
    ).toBeVisible();
    expect(requestCount).toBe(0);
  });
});
