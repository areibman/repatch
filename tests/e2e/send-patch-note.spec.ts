import { test, expect } from "@playwright/test";

test("sends a patch note via the active provider", async ({ page }) => {
  const patchNote = {
    id: "123",
    repo_name: "acme/repatch",
    repo_url: "https://github.com/acme/repatch",
    time_period: "1week",
    generated_at: new Date().toISOString(),
    title: "Weekly Updates",
    content: "## Highlights\n- Added new feature",
    changes: { added: 5, modified: 3, removed: 1 },
    contributors: ["dev1"],
  };

  const providerSummary = {
    id: "resend",
    label: "Resend",
    isActive: true,
    fromEmail: "team@example.com",
    capabilities: { canListSubscribers: true, canManageSubscribers: true },
    hasApiKey: true,
    updatedAt: new Date().toISOString(),
    additional: { replyTo: "hello@example.com" },
    source: "database",
  };

  let sendCalled = false;

  await page.route("**/api/patch-notes/123", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({ json: patchNote });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/email/providers/active", async (route) => {
    await route.fulfill({ json: { provider: providerSummary, source: "database" } });
  });

  await page.route("**/api/patch-notes/123/send", async (route, request) => {
    if (request.method() === "POST") {
      sendCalled = true;
      await route.fulfill({
        json: {
          success: true,
          sentTo: 3,
          emailId: "mock-email-id",
          provider: providerSummary,
        },
      });
      return;
    }
    await route.fallback();
  });

  const dialogPromise = new Promise<void>((resolve) => {
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("via Resend");
      await dialog.accept();
      resolve();
    });
  });

  await page.goto("/blog/123");

  await expect(page.getByText("Delivering via Resend")).toBeVisible();

  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/api/patch-notes/123/send")
    ),
    page.getByRole("button", { name: "Send Email" }).click(),
    dialogPromise,
  ]);

  expect(sendCalled).toBeTruthy();
});
