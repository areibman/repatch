import { test, expect, APIRequestContext } from "@playwright/test";

async function resetDatabase(request: APIRequestContext) {
  await request.post("/api/test-support/reset");
}

test.describe("patch note smoke", () => {
  test.beforeEach(async ({ request }) => {
    await resetDatabase(request);
  });

  test("user can create, edit, and email a patch note", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Repatch" })).toBeVisible();
    await expect(page.getByText("Weekly Update - awesome-app")).toBeVisible();

    await page.getByRole("button", { name: "Create New Post" }).click();

    const repoInput = page.getByPlaceholder("https://github.com/owner/repository");
    await repoInput.fill("https://github.com/acme/next-launch");

    await expect(page.getByText("Fetching branches...")).toBeVisible();
    await expect(page.getByText("Fetching branches...")).not.toBeVisible();

    const branchTrigger = page.getByLabel("Branch");
    await branchTrigger.click();
    await page.getByRole("option", { name: "main" }).click();

    await expect(page.getByRole("button", { name: "Create Patch Note" })).toBeEnabled();

    await Promise.all([
      page.waitForURL("**/blog/**"),
      page.getByRole("button", { name: "Create Patch Note" }).click(),
    ]);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Weekly Update - next-launch",
      })
    ).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();

    const textareas = page.locator("textarea");
    await textareas.nth(0).fill("Weekly Update - next-launch (edited)");
    await textareas
      .nth(1)
      .fill("# Updated summary\n\n- Highlighted the new onboarding milestones");

    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Weekly Update - next-launch (edited)",
      })
    ).toBeVisible();

    const confirmPromise = new Promise<void>((resolve) => {
      page.once("dialog", (dialog) => {
        expect(dialog.type()).toBe("confirm");
        expect(dialog.message()).toContain("Send this patch note");
        dialog.accept();
        resolve();
      });
    });

    const alertPromise = new Promise<void>((resolve) => {
      page.once("dialog", (dialog) => {
        expect(dialog.type()).toBe("alert");
        expect(dialog.message()).toContain("Patch note successfully sent");
        dialog.accept();
        resolve();
      });
    });

    await page.getByRole("button", { name: "Send Email" }).click();

    await confirmPromise;
    await alertPromise;
  });
});
