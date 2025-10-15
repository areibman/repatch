import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.post("/api/testing/reset-memory");
});

test("queues a Typefully thread with mock upload", async ({ page, request }) => {
  await page.goto("/integrations/typefully/configure");
  await expect(page.getByRole("heading", { name: "Connect Typefully" })).toBeVisible();

  await page.fill('input[placeholder="tf_api_..."]', "tf_api_mock_key");
  await page.fill('input[placeholder="profile_123"]', "profile_mock");
  await page.fill('input[placeholder="workspace_123"]', "workspace_mock");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Typefully credentials saved")).toBeVisible();

  await page.goto("/blog/memory-patch-note");
  await expect(page.getByRole("heading", { name: "Repatch 1.4" })).toBeVisible();

  const queueButton = page.getByRole("button", { name: /Queue Twitter thread/i });
  await queueButton.click();
  await expect(page.getByTestId("typefully-queue-message")).toHaveText(
    "Thread queued successfully."
  );

  await expect.poll(async () => {
    const response = await request.get(
      "/api/patch-notes/memory-patch-note/typefully"
    );
    if (!response.ok()) {
      return null;
    }
    const data = await response.json();
    return data.job?.status ?? null;
  }, { timeout: 10000 }).toBe("queued");
});
