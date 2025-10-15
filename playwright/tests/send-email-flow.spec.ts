import { test, expect } from "@playwright/test";

test("sends patch note via active provider", async ({ page }) => {
  await page.route("**/api/patch-notes/test-note", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "test-note",
        repo_name: "mock/repo",
        repo_url: "https://example.com",
        time_period: "1week",
        generated_at: new Date().toISOString(),
        title: "Mock Patch Note",
        content: "## Update\n\n- Added tests",
        changes: { added: 5, modified: 1, removed: 0 },
        contributors: ["mock"],
        video_url: null,
      }),
    });
  });

  await page.route("**/api/videos/status/test-note", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hasVideo: false }),
    });
  });

  await page.route("**/api/patch-notes/test-note/send", async (route) => {
    expect(route.request().method()).toBe("POST");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        sentTo: 2,
        provider: "Resend (Mock)",
        emailId: "mock-123",
      }),
    });
  });

  await page.goto("/blog/test-note");

  await expect(
    page.getByText("Emails will be delivered with", { exact: false })
  ).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Resend (Mock)");
    await dialog.accept();
  });

  const sendButton = page.getByRole("button", { name: "Send Email" });
  await expect(sendButton).toBeVisible();

  const alertPromise = new Promise<void>((resolve) => {
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("successfully sent");
      await dialog.accept();
      resolve();
    });
  });

  await sendButton.click();
  await alertPromise;
});
