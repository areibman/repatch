import { expect, test } from "@playwright/test";

test.describe("GitHub integration", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/test-utils/reset", {
      data: {
        supabase: {
          github_configs: [],
          patch_notes: [],
          email_subscribers: [],
        },
        resend: {
          contacts: [],
        },
      },
    });
  });

  test("saves configuration details", async ({ page, request }) => {
    await page.goto("/integrations/github/configure");
    await page.getByLabel("Repository URL").fill("https://github.com/acme/awesome-project");
    await page.getByLabel("Access Token").fill("ghp_playwright-token");

    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("status", { name: /GitHub connection saved/i })).toBeVisible();

    const stateResponse = await request.get("/api/test-utils/reset");
    const snapshot = await stateResponse.json();
    expect(snapshot.supabase.github_configs).toHaveLength(1);
    expect(snapshot.supabase.github_configs[0].repo_url).toBe("https://github.com/acme/awesome-project");
  });
});
