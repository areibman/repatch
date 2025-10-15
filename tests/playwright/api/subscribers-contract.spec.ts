import { expect, test } from "@playwright/test";

test.describe("Subscriber API", () => {
  const audienceId = "fa2a9141-3fa1-4d41-a873-5883074e6516";

  test.beforeEach(async ({ request }) => {
    await request.post("/api/test-utils/reset", {
      data: {
        supabase: {
          patch_notes: [],
          github_configs: [],
          email_subscribers: [],
        },
        resend: {
          contacts: [
            {
              email: "existing@example.com",
              audienceId,
              unsubscribed: false,
            },
          ],
        },
      },
    });
  });

  test("lists and manages contacts offline", async ({ request }) => {
    const listResponse = await request.get("/api/subscribers");
    expect(listResponse.ok()).toBeTruthy();
    const subscribers = await listResponse.json();
    expect(subscribers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: "existing@example.com", active: true }),
      ])
    );

    const createResponse = await request.post("/api/subscribers", {
      data: { email: "new@example.com" },
    });
    expect(createResponse.status()).toBe(201);

    const deleteResponse = await request.delete(
      `/api/subscribers?email=${encodeURIComponent("new@example.com")}`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    const updateResponse = await request.put("/api/subscribers", {
      data: { email: "existing@example.com", unsubscribed: true },
    });
    expect(updateResponse.ok()).toBeTruthy();
    const updated = await updateResponse.json();
    expect(updated.active).toBe(false);
  });
});
