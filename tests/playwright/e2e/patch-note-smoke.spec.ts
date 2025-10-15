import { expect, test, type Dialog } from "@playwright/test";

const subscriberSeed = {
  resend: {
    contacts: [
      {
        email: "subscriber@example.com",
        audienceId: "fa2a9141-3fa1-4d41-a873-5883074e6516",
        unsubscribed: false,
      },
    ],
  },
  supabase: {
    patch_notes: [],
    github_configs: [],
    email_subscribers: [],
  },
};

test.describe("Patch note happy path", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/test-utils/reset", {
      data: subscriberSeed,
    });
  });

  test("creates, publishes, and emails a patch note", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Repatch" })).toBeVisible();

    await page.getByRole("button", { name: "Create New Post" }).click();
    await page.getByLabel("Repository URL").fill("https://github.com/acme/awesome-project");

    const createButton = page.getByRole("button", { name: "Create Patch Note", exact: true });
    await expect(createButton).toBeEnabled({ timeout: 10_000 });

    const navigationPromise = page.waitForURL("**/blog/**");
    await createButton.click();
    await navigationPromise;

    const patchNoteUrl = page.url();
    const patchNoteId = patchNoteUrl.split("/").pop();
    expect(patchNoteId).toBeTruthy();

    await expect(page.getByRole("heading", { name: /Weekly Update - awesome-project/i })).toBeVisible();
    await expect(page.getByText("Lines Added")).toBeVisible();

    const dialogMessages: string[] = [];
    const dialogHandler = (dialog: Dialog) => {
      dialogMessages.push(dialog.message());
      dialog.accept();
    };
    page.on("dialog", dialogHandler);

    const sendResponse = page.waitForResponse((response) =>
      patchNoteId
        ? response.url().includes(`/api/patch-notes/${patchNoteId}/send`) && response.request().method() === "POST"
        : false
    );

    await page.getByRole("button", { name: /Send Email/i }).click();
    await sendResponse;

    await expect.poll(() => dialogMessages.some((message) => message.includes("Patch note successfully sent"))).toBeTruthy();
    page.off("dialog", dialogHandler);

    const stateResponse = await request.get("/api/test-utils/reset");
    const snapshot = await stateResponse.json();
    expect(Array.isArray(snapshot.supabase.patch_notes)).toBe(true);
    expect(snapshot.supabase.patch_notes).toHaveLength(1);
    expect(snapshot.supabase.patch_notes[0].repo_name).toBe("acme/awesome-project");

    await page.goto("/");
    await expect(page.getByText("Weekly Update - awesome-project")).toBeVisible();
  });
});
