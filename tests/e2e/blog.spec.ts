import { test, expect } from "@playwright/test";

test("allows editing, emailing, and video generation for a patch note", async ({ page }) => {
  const patchNote = {
    id: "patch-123",
    repo_name: "openai/repatch",
    repo_url: "https://github.com/openai/repatch",
    time_period: "1week",
    generated_at: new Date().toISOString(),
    title: "Weekly Digest - Repatch",
    content: "## Highlights\n\n- Initial summary",
    changes: { added: 400, modified: 0, removed: 120 },
    contributors: ["alice", "bob", "carol"],
    video_url: null,
    video_data: {
      langCode: "en",
      topChanges: [
        { title: "Initial summary", description: "Initial summary" },
      ],
      allChanges: ["Initial summary"],
    },
  };

  await page.addInitScript(() => {
    window.location.reload = () => {};
  });

  await page.route("**/api/patch-notes/patch-123", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ status: 200, body: JSON.stringify(patchNote) });
      return;
    }

    if (method === "PUT") {
      const body = route.request().postDataJSON() as any;
      expect(body.title).toContain("Refined");
      expect(body.content).toContain("Updated summary");
      patchNote.title = body.title;
      patchNote.content = body.content;
      await route.fulfill({ status: 200, body: JSON.stringify(patchNote) });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/videos/status/patch-123", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ hasVideo: false }) })
  );

  await page.route("**/api/patch-notes/patch-123/send", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ sentTo: 3 }) })
  );

  await page.route("**/api/videos/render", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ videoUrl: "/videos/generated.mp4" }) })
  );

  const dialogMessages: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.accept();
  });

  await page.goto("/blog/patch-123");

  await expect(
    page.getByRole("heading", { name: patchNote.title, level: 1 })
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();

  await page
    .getByPlaceholder("Enter title...")
    .fill("Refined Weekly Digest - Repatch");
  await page
    .getByPlaceholder("Enter patch notes content...")
    .fill("Updated summary with more details and follow-up items.");

  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.getByTestId("patch-note-content")).toContainText(
    "Updated summary with more details"
  );

  const sendRequest = page.waitForRequest("**/api/patch-notes/patch-123/send");
  await page.getByRole("button", { name: "Send Email" }).click();
  await sendRequest;
  await expect(page.getByRole("button", { name: "Send Email" })).toBeEnabled();

  const renderRequest = page.waitForRequest("**/api/videos/render");
  await page.getByRole("button", { name: /Generate Video/i }).click();
  await renderRequest;

  patchNote.video_url = "/videos/generated.mp4";

  await expect(page.getByTestId("custom-video-indicator")).toBeVisible();
  await expect(page.getByRole("button", { name: /Generate Video/i })).toHaveCount(0);

  expect(dialogMessages).toEqual([
    "Send this patch note to all email subscribers?",
    "✅ Patch note successfully sent to 3 subscribers!",
    "✅ Video generated successfully! The page will refresh.",
  ]);
});
