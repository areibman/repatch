import { test, expect } from "@playwright/test";

const mockPatchNote = {
  id: "mock-note",
  repo_name: "acme/repatch",
  repo_url: "https://github.com/acme/repatch",
  time_period: "1week",
  title: "Mock Patch Note",
  content: "### Updates\n- Added mock feature\n- Improved tests",
  changes: { added: 10, modified: 4, removed: 1 },
  contributors: ["robot"],
  video_url: null,
  generated_at: new Date().toISOString(),
};

test.describe("Typefully integration", () => {
  test("queues a Typefully thread with mock upload", async ({ page }) => {
    await page.route("**/api/patch-notes/mock-note", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPatchNote),
      });
    });

    await page.route("**/api/videos/status/mock-note", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hasVideo: false, videoUrl: null }),
      });
    });

    let jobFetches = 0;
    await page.route("**/api/patch-notes/mock-note/typefully/jobs", async (route) => {
      jobFetches += 1;
      if (jobFetches === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "null",
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/blog/mock-note");

    await expect(page.getByRole("heading", { name: "Mock Patch Note" })).toBeVisible();
    await expect(page.getByText("No Typefully thread queued yet.")).toBeVisible();

    const queueButton = page.getByRole("button", { name: "Queue Twitter thread" });

    const queueResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/patch-notes/mock-note/typefully/queue") &&
      response.request().method() === "POST"
    );

    const dialogPromise = new Promise<void>((resolve) => {
      page.once("dialog", async (dialog) => {
        expect(dialog.message()).toContain("Thread queued");
        await dialog.accept();
        resolve();
      });
    });

    await queueButton.click();

    const queueResponse = await queueResponsePromise;
    const payload = await queueResponse.json();
    expect(payload.status).toBe("queued");
    expect(payload.threadId).toBeTruthy();

    await dialogPromise;

    await expect(queueButton).toBeEnabled();
    await expect(page.getByText(/Latest Typefully job:/)).toContainText("queued");
  });
});
