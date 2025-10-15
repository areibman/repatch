import { expect, test } from "@playwright/test";

const branchOption = "main";

function extractPatchNoteId(url: string): string | null {
  const parts = url.split("/");
  return parts.length ? parts[parts.length - 1] : null;
}

test.describe("Patch note workflow", () => {
  test("creates, edits, and surfaces a patch note", async ({ page, context }) => {
    const uniqueSuffix = Date.now();
    const repoUrl = `https://github.com/mock-org/repatch-${uniqueSuffix}`;

    await page.goto("/");
    await page.getByRole("button", { name: /Create New Post/i }).click();
    await page.getByLabel("Repository URL").fill(repoUrl);

    const branchTrigger = page.getByRole("button", { name: /Select branch/i });
    await branchTrigger.click();
    await page.getByRole("option", { name: branchOption }).click();

    const submitButton = page.getByRole("button", { name: /Create Patch Note/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await page.waitForURL(/\/blog\//, { timeout: 90_000 });
    const blogHeading = page.getByRole("heading", { level: 1 });
    await expect(blogHeading).toContainText("Update");

    const patchNoteId = extractPatchNoteId(page.url());
    expect(patchNoteId).not.toBeNull();

    await page.getByRole("button", { name: "Edit" }).click();
    const titleField = page.getByPlaceholder("Enter title...");
    const updatedTitle = `Weekly Update - QA ${uniqueSuffix}`;
    await titleField.fill(updatedTitle);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();

    await page.getByRole("button", { name: /Back to Home/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();

    if (patchNoteId) {
      await context.request.delete(`/api/patch-notes/${patchNoteId}`);
    }
  });
});
