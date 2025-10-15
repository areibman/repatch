import { test, expect, APIRequestContext } from "@playwright/test";

async function resetDatabase(request: APIRequestContext) {
  await request.post("/api/test-support/reset");
}

test.describe("offline API contracts", () => {
  test.beforeEach(async ({ request }) => {
    await resetDatabase(request);
  });

  test("github branches endpoint uses fixtures when integrations are mocked", async ({ request }) => {
    const response = await request.get(
      "/api/github/branches?owner=acme&repo=demo"
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data[0]).toMatchObject({ name: "main" });
  });

  test("patch note creation and email sending succeed offline", async ({ request }) => {
    const createResponse = await request.post("/api/patch-notes", {
      data: {
        repo_name: "acme/next-launch",
        repo_url: "https://github.com/acme/next-launch",
        time_period: "1week",
        title: "Weekly Update - next-launch",
        content: "# Summary\n\n- Added offline test coverage",
        changes: { added: 10, modified: 0, removed: 2 },
        contributors: ["@alice"],
        generated_at: new Date().toISOString(),
      },
    });

    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();
    expect(created).toHaveProperty("id");

    const sendResponse = await request.post(
      `/api/patch-notes/${created.id}/send`
    );
    expect(sendResponse.ok()).toBeTruthy();

    const body = await sendResponse.json();
    expect(body).toMatchObject({ success: true, sentTo: 2 });
  });
});
