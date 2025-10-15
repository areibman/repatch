import { test, expect, APIRequestContext } from "@playwright/test";

async function resetDatabase(request: APIRequestContext) {
  await request.post("/api/test-support/reset");
}

test.describe("integration configuration", () => {
  test.beforeEach(async ({ request }) => {
    await resetDatabase(request);
  });

  test("github integration can be saved with mock supabase", async ({ page }) => {
    await page.goto("/integrations/github/configure");

    await page.getByPlaceholder("https://github.com/owner/repo").fill(
      "https://github.com/acme/awesome-app"
    );
    await page.getByPlaceholder("ghp_...").fill("ghp_mocktoken123");

    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByRole("status", { name: "GitHub connection saved successfully." })
    ).toBeVisible();
  });

  test("resend integration provides inline confirmation", async ({ page }) => {
    await page.goto("/integrations/resend/configure");

    await page.getByPlaceholder("re_...").fill("re_mock_key");
    await page
      .getByPlaceholder("Patch Notes <patch@yourdomain.com>")
      .fill("Patch Notes <patch@example.com>");

    const dialogPromise = new Promise<void>((resolve) => {
      page.once("dialog", (dialog) => {
        expect(dialog.type()).toBe("alert");
        expect(dialog.message()).toContain("Saved Resend configuration");
        dialog.accept();
        resolve();
      });
    });

    await page.getByRole("button", { name: "Save" }).click();

    await dialogPromise;
  });
});
