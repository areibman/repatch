import { test, expect } from "@playwright/test";

test.describe("Email provider configuration", () => {
  test("updates Resend settings and activates provider", async ({ page }) => {
    const initialSummary = {
      id: "resend",
      label: "Resend",
      isActive: false,
      fromEmail: "patch@example.com",
      capabilities: { canListSubscribers: true, canManageSubscribers: true },
      hasApiKey: true,
      updatedAt: new Date().toISOString(),
      additional: {
        audienceId: "aud-123",
        fromName: "Repatch",
        replyTo: "support@example.com",
      },
      source: "database",
    };

    let lastUpsert: any = null;
    let patchCalled = false;

    await page.route("**/api/email/providers", async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({ json: { providers: [initialSummary], active: null } });
        return;
      }

      if (request.method() === "POST") {
        lastUpsert = await request.postDataJSON();
        const updatedSummary = {
          ...initialSummary,
          fromEmail: lastUpsert.config?.fromEmail || initialSummary.fromEmail,
          isActive: Boolean(lastUpsert.setActive),
        };
        await route.fulfill({
          json: {
            provider: updatedSummary,
            active: lastUpsert.setActive ? updatedSummary : null,
          },
        });
        return;
      }

      if (request.method() === "PATCH") {
        patchCalled = true;
        const activeSummary = { ...initialSummary, isActive: true };
        await route.fulfill({ json: { provider: activeSummary, active: activeSummary } });
        return;
      }

      await route.fallback();
    });

    await page.goto("/integrations/resend/configure");

    await page.getByLabel("From Email").fill("deliver@example.com");
    await page.getByLabel("Set Resend as the active provider after saving").check();

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes("/api/email/providers") &&
        response.request().method() === "POST"
      ),
      page.getByRole("button", { name: "Save" }).click(),
    ]);

    expect(lastUpsert).toMatchObject({
      provider: "resend",
      config: expect.objectContaining({ fromEmail: "deliver@example.com" }),
      setActive: true,
    });

    await expect(
      page.getByText("Resend settings saved successfully")
    ).toBeVisible();

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes("/api/email/providers") &&
        response.request().method() === "PATCH"
      ),
      page.getByRole("button", { name: "Make Active" }).click(),
    ]);

    expect(patchCalled).toBeTruthy();
    await expect(page.getByText("Resend is now the active provider")).toBeVisible();
  });
});
