import { test, expect } from "@playwright/test";

test("shows active mock provider on integrations page", async ({ page }) => {
  await page.goto("/integrations");

  await expect(page.getByText("Resend (Mock)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Active" })).toBeVisible();
  await expect(
    page.getByText("Sender not configured", { exact: false })
  ).toBeVisible();
});
