import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.post("/api/testing/reset");
});

test("user can create and publish a patch note", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Repatch" })).toBeVisible();
  await expect(page.getByText("Weekly Update: New Features and Bug Fixes")).toBeVisible();

  await page.getByRole("button", { name: "Create New Post" }).click();
  await page.getByLabel("Repository URL").fill("https://github.com/acme/awesome-project");

  const branchSelect = page.getByRole("combobox", { name: "Branch" });
  await branchSelect.waitFor();
  await branchSelect.click();
  await page.getByRole("option", { name: "main" }).click();

  await page.getByRole("button", { name: "Create Patch Note" }).click();

  await page.waitForURL(/\/blog\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Weekly Update - awesome-project");

  const confirmPromise = page.waitForEvent("dialog");
  await page.getByRole("button", { name: /Send Email/i }).click();
  const confirmDialog = await confirmPromise;
  expect(confirmDialog.message()).toContain("Send this patch note");

  const alertPromise = page.waitForEvent("dialog");
  await confirmDialog.accept();
  const alertDialog = await alertPromise;
  expect(alertDialog.message()).toContain("Patch note successfully sent");
  await alertDialog.accept();
});

test("integrations can be configured", async ({ page }) => {
  await page.goto("/integrations/github/configure");

  await page.getByLabel("Repository URL").fill("https://github.com/octocat/hello-world");
  await page.getByLabel("Access Token").fill("ghp_test_token");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("github-config-success")).toBeVisible();

  await page.goto("/integrations/resend/configure");
  await page.getByLabel("API Key").fill("re_test_key");
  await page.getByLabel("From Email").fill("Patch Notes <patch@example.com>");

  const alertPromise = page.waitForEvent("dialog");
  await page.getByRole("button", { name: "Save" }).click();
  const alert = await alertPromise;
  expect(alert.message()).toContain("Saved Resend configuration");
  await alert.accept();
});

test("subscriber dashboard renders seeded data", async ({ page }) => {
  await page.goto("/subscribers");
  await expect(page.getByRole("heading", { name: "Subscribers" })).toBeVisible();
  await expect(page.getByText("Total Subscribers")).toBeVisible();
  await expect(page.getByText("dev@acme.dev")).toBeVisible();
});
