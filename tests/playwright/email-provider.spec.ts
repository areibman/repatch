import { test, expect } from "@playwright/test";

const samplePatchNote = {
  id: "test-id",
  repo_name: "repatch",
  repo_url: "https://github.com/example/repatch",
  time_period: "1week",
  generated_at: new Date().toISOString(),
  title: "Weekly Updates",
  content: "## Improvements\n- Added provider support",
  changes: { added: 4, modified: 2, removed: 1 },
  contributors: ["Alice", "Bob"],
  video_url: null,
  repo_branch: "main",
  ai_summaries: [],
  ai_overall_summary: null,
  filter_metadata: null,
  ai_template_id: null,
  video_top_changes: null,
  ai_detailed_contexts: null,
};

test.describe("email providers", () => {
  test("displays active provider across dashboard and subscribers", async ({ page }) => {
    await page.route("**/api/email/providers", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          activeProvider: "customerio",
          providers: [
            {
              id: "customerio",
              name: "Customer.io",
              isActive: true,
              configured: true,
              source: "database",
              lastUpdated: new Date().toISOString(),
              fields: [
                {
                  key: "fromEmail",
                  label: "From Email",
                  type: "email",
                  value: "product@customer.io",
                },
              ],
            },
          ],
        }),
      });
    });

    await page.route("**/api/patch-notes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([samplePatchNote]),
      });
    });

    await page.route("**/api/subscribers", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "1",
            email: "user@example.com",
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto("/");
    await expect(page.getByText("Email via Customer.io")).toBeVisible();

    await page.goto("/subscribers");
    await expect(
      page.getByText("Your Customer.io configuration for patch notes subscribers.")
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage in Customer.io" }).first()
    ).toBeVisible();
  });

  test("disables send button when provider is not configured", async ({ page }) => {
    await page.route("**/api/email/providers", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          activeProvider: "resend",
          providers: [
            {
              id: "resend",
              name: "Resend",
              isActive: true,
              configured: false,
              source: "missing",
              lastUpdated: null,
              fields: [],
            },
          ],
        }),
      });
    });

    await page.route("**/api/patch-notes/test-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(samplePatchNote),
      });
    });

    await page.route("**/api/ai-templates", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/videos/status/test-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hasVideo: false }),
      });
    });

    await page.goto("/blog/test-id");

    const sendButton = page.getByRole("button", { name: "Configure Email Provider" });
    await expect(sendButton).toBeDisabled();
    await expect(
      page.getByText(
        "Add Resend credentials in Settings → Email to enable sending."
      )
    ).toBeVisible();
  });

  test("sends patch note email via active provider", async ({ page }) => {
    await page.route("**/api/email/providers", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          activeProvider: "resend",
          providers: [
            {
              id: "resend",
              name: "Resend",
              isActive: true,
              configured: true,
              source: "database",
              lastUpdated: new Date().toISOString(),
              fields: [],
            },
          ],
        }),
      });
    });

    await page.route("**/api/patch-notes/test-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(samplePatchNote),
      });
    });

    await page.route("**/api/ai-templates", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/videos/status/test-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hasVideo: false }),
      });
    });

    await page.route("**/api/patch-notes/test-id/send", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          provider: "resend",
          sentTo: 5,
          failed: 0,
          failures: [],
        }),
      });
    });

    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    await page.goto("/blog/test-id");

    const sendButton = page.getByRole("button", { name: /Send Email via Resend/i });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    await expect.poll(() => dialogs.length).toBeGreaterThanOrEqual(2);
    expect(dialogs).toContain("Send this patch note to all email subscribers?");
    expect(
      dialogs.some((message) => message.includes("successfully sent"))
    ).toBeTruthy();
  });
});
