import { test, expect } from "@playwright/test";

test("renders subscriber metrics and list", async ({ page }) => {
  const subscribers = [
    {
      id: "sub-1",
      email: "alice@example.com",
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "sub-2",
      email: "bob@example.com",
      active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "sub-3",
      email: "carol@example.com",
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  await page.route("**/api/subscribers", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify(subscribers) })
  );

  await page.goto("/subscribers");

  await expect(page.getByRole("heading", { name: "Subscribers" })).toBeVisible();
  await expect(page.getByTestId("subscriber-total-count")).toHaveText("3");
  await expect(page.getByTestId("subscriber-active-count")).toHaveText("2");
  await expect(page.getByTestId("subscriber-inactive-count")).toHaveText("1");

  await expect(page.getByText("alice@example.com")).toBeVisible();
  await expect(page.getByText("bob@example.com")).toBeVisible();
  await expect(page.getByText("carol@example.com")).toBeVisible();
});

test("shows the empty state when there are no subscribers", async ({ page }) => {
  await page.route("**/api/subscribers", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify([]) })
  );

  await page.goto("/subscribers");

  await expect(page.getByText("No subscribers yet")).toBeVisible();
  await expect(
    page.getByText(
      "Your audience is empty. Add subscribers through Resend or your signup forms."
    )
  ).toBeVisible();
});
