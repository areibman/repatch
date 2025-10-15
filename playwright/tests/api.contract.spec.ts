import { test, expect } from "@playwright/test";

const repoPayload = {
  repo_name: "acme/awesome-project",
  repo_url: "https://github.com/acme/awesome-project",
  time_period: "1week",
  title: "Weekly Update - awesome-project",
  content: "# Changelog\n\n- Added tests",
  changes: { added: 10, modified: 2, removed: 1 },
  contributors: ["@qa"],
};

test.beforeEach(async ({ request }) => {
  await request.post("/api/testing/reset");
});

test("GitHub fixtures respond offline", async ({ request }) => {
  const branches = await request.get(
    "/api/github/branches?owner=acme&repo=awesome-project"
  );
  expect(branches.ok()).toBeTruthy();
  const branchPayload = await branches.json();
  expect(branchPayload).toContainEqual({ name: "main", protected: true });

  const stats = await request.get(
    "/api/github/stats?owner=acme&repo=awesome-project&timePeriod=1week"
  );
  expect(stats.ok()).toBeTruthy();
  const statsPayload = await stats.json();
  expect(statsPayload).toMatchObject({ commits: expect.any(Number) });
});

test("patch note send flow emits mock response", async ({ request }) => {
  const create = await request.post("/api/patch-notes", { data: repoPayload });
  expect(create.ok()).toBeTruthy();
  const created = await create.json();
  expect(created).toMatchObject({ repo_name: repoPayload.repo_name });

  const send = await request.post(`/api/patch-notes/${created.id}/send`);
  expect(send.ok()).toBeTruthy();
  const payload = await send.json();
  expect(payload).toMatchObject({ mode: "mock", sentTo: expect.any(Number) });
});

test("subscriber APIs operate against mock store", async ({ request }) => {
  const list = await request.get("/api/subscribers");
  expect(list.ok()).toBeTruthy();
  const subscribers = await list.json();
  expect(Array.isArray(subscribers)).toBe(true);
  expect(subscribers.length).toBeGreaterThan(0);
  const sampleEmail = subscribers[0].email;

  const add = await request.post("/api/subscribers", {
    data: { email: "playwright@example.com" },
  });
  expect(add.ok()).toBeTruthy();
  const created = await add.json();
  expect(created).toMatchObject({ mode: "mock", email: "playwright@example.com" });

  const update = await request.put("/api/subscribers", {
    data: { email: sampleEmail, unsubscribed: true },
  });
  expect(update.ok()).toBeTruthy();
  const updated = await update.json();
  expect(updated).toMatchObject({ mode: "mock", active: false });
});

test("video render endpoint shortcuts in mock mode", async ({ request }) => {
  const create = await request.post("/api/patch-notes", { data: repoPayload });
  const created = await create.json();

  const render = await request.post("/api/videos/render", {
    data: {
      patchNoteId: created.id,
      videoData: { langCode: "en", topChanges: [], allChanges: [] },
      repoName: "acme/awesome-project",
    },
  });
  expect(render.ok()).toBeTruthy();
  const result = await render.json();
  expect(result).toMatchObject({ mode: "mock", success: true, videoUrl: expect.stringContaining("/videos/") });

  const status = await request.get(`/api/videos/status/${created.id}`);
  expect(status.ok()).toBeTruthy();
  const statusPayload = await status.json();
  expect(statusPayload).toMatchObject({ mode: "mock", hasVideo: true });
});
