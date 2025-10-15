import { expect, test } from "@playwright/test";

function buildPatchNotePayload(title: string) {
  return {
    repo_name: "mock-org/repatch",
    repo_url: "https://github.com/mock-org/repatch",
    time_period: "1week",
    title,
    content: `# ${title}\n\n- feature A\n- feature B`,
    changes: { added: 120, modified: 30, removed: 12 },
    contributors: ["@alice", "@bob"],
    generated_at: new Date().toISOString(),
  };
}

test.describe("Publishing flows", () => {
  test("sends a patch note email using mocked Resend", async ({ request }) => {
    const createResponse = await request.post("/api/patch-notes", {
      data: buildPatchNotePayload(`QA broadcast ${Date.now()}`),
    });
    expect(createResponse.status()).toBe(201);

    const created = await createResponse.json();
    const patchNoteId = created.id as string;
    expect(patchNoteId).toBeTruthy();

    const sendResponse = await request.post(`/api/patch-notes/${patchNoteId}/send`);
    expect(sendResponse.ok()).toBeTruthy();
    const sendPayload = await sendResponse.json();
    expect(sendPayload.sentTo).toBeGreaterThan(0);

    await request.delete(`/api/patch-notes/${patchNoteId}`);
  });

  test("lists email subscribers from mocked Resend audience", async ({ request }) => {
    const response = await request.get("/api/subscribers");
    expect(response.ok()).toBeTruthy();
    const subscribers = await response.json();
    expect(Array.isArray(subscribers)).toBe(true);
    if (subscribers.length > 0) {
      expect(subscribers[0]).toHaveProperty("email");
    }
  });
});
