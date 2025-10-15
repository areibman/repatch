import { test, expect } from "@playwright/test";

const initialPatchNotes = [
  {
    id: "1",
    repo_name: "openai/repatch",
    repo_url: "https://github.com/openai/repatch",
    time_period: "1week" as const,
    generated_at: new Date("2024-03-18T12:00:00Z").toISOString(),
    title: "Weekly Update - Repatch",
    content: "## Highlights\n- Added new UI components\n- Improved testing",
    changes: { added: 420, modified: 112, removed: 87 },
    contributors: ["alice", "bob"],
    video_url: null,
    video_data: {
      langCode: "en",
      topChanges: [
        {
          title: "Improved testing",
          description: "Added Playwright end-to-end coverage",
          stats: { additions: 200, deletions: 50 },
        },
      ],
      allChanges: [],
    },
  },
  {
    id: "2",
    repo_name: "openai/remotion",
    repo_url: "https://github.com/openai/remotion",
    time_period: "1month" as const,
    generated_at: new Date("2024-02-28T12:00:00Z").toISOString(),
    title: "Monthly Video Update",
    content: "Patch note content",
    changes: { added: 1280, modified: 640, removed: 320 },
    contributors: ["carol"],
    video_url: "https://example.com/video.mp4",
    video_data: null,
  },
];

test.describe("Repatch end-to-end", () => {
  test.beforeEach(async ({ page }) => {
    const patchNotes = JSON.parse(JSON.stringify(initialPatchNotes)) as typeof initialPatchNotes;

    await page.route("**/api/patch-notes", async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(patchNotes),
        });
        return;
      }

      if (request.method() === "POST") {
        const payload = request.postDataJSON() as Record<string, any>;
        const created = {
          ...payload,
          id: "3",
          generated_at: payload.generated_at ?? new Date().toISOString(),
          video_url: null,
        };
        patchNotes.unshift(created);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(created),
        });
        return;
      }

      await route.fallback();
    });

    await page.route("**/api/patch-notes/*", async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();

      if (url.pathname.endsWith("/send")) {
        if (method === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ sentTo: 42 }),
          });
          return;
        }

        await route.fallback();
        return;
      }

      const id = url.pathname.split("/").pop()!;
      const note = patchNotes.find((item) => item.id === id);

      if (method === "GET") {
        await route.fulfill({
          status: note ? 200 : 404,
          contentType: "application/json",
          body: JSON.stringify(note ?? { error: "Not found" }),
        });
        return;
      }

      if (method === "PUT") {
        const payload = route.request().postDataJSON() as Record<string, any>;
        if (note) {
          note.title = payload.title;
          note.content = payload.content;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(note ?? { error: "Not found" }),
        });
        return;
      }

      await route.fallback();
    });

    await page.route("**/api/videos/render", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "queued",
          videoUrl: "https://example.com/generated.mp4",
        }),
      });
    });

    await page.route("**/api/videos/status/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hasVideo: false }),
      });
    });

    await page.route("**/api/subscribers", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "sub-1",
            email: "alice@example.com",
            active: true,
            created_at: "2024-01-01T12:00:00Z",
            updated_at: "2024-02-01T12:00:00Z",
          },
          {
            id: "sub-2",
            email: "bob@example.com",
            active: false,
            created_at: "2024-02-10T12:00:00Z",
            updated_at: "2024-03-01T12:00:00Z",
          },
        ]),
      });
    });

    await page.route("**/api/github/branches**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { name: "main", protected: true },
          { name: "dev", protected: false },
        ]),
      });
    });

    await page.route("**/api/github/stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          commits: 12,
          additions: 500,
          deletions: 120,
          contributors: ["alice", "bob"],
          commitMessages: ["chore: update tests"],
        }),
      });
    });

    await page.route("**/api/github/summarize", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summaries: [
            {
              message: "Improve test coverage",
              aiSummary: "Expanded E2E coverage across major flows",
              additions: 400,
              deletions: 50,
            },
          ],
          overallSummary: "Coverage enhanced",
        }),
      });
    });
  });

  test("home dashboard supports creation and navigation", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Repatch" })).toBeVisible();

    await expect(page.getByText("Total Posts").locator(".."))
      .toContainText("2");
    await expect(page.getByText("Repositories").locator(".."))
      .toContainText("2");

    const firstCard = page.getByRole("link", { name: /Weekly Update - Repatch/ });
    await expect(firstCard).toBeVisible();

    await page.getByRole("button", { name: "Create New Post" }).click();
    await expect(page.getByRole("heading", { name: "Create Patch Note" })).toBeVisible();

    await page.getByLabel("Repository URL").fill("https://github.com/openai/new-repo");

    const branchSelect = page.getByRole("combobox", { name: "Branch" });
    await branchSelect.click();
    await page.getByRole("option", { name: "dev" }).click();

    await page.getByRole("combobox", { name: "Time Period" }).click();
    await page.getByRole("option", { name: "Last Month" }).click();

    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/patch-notes") && res.request().method() === "POST"
      ),
      page.getByRole("button", { name: "Create Patch Note" }).click(),
    ]);

    expect(response.status()).toBe(201);

    await page.waitForURL("**/blog/3");
    await expect(
      page.getByRole("heading", { name: "Monthly Update - new-repo" })
    ).toBeVisible();
    await expect(page.getByText("Coverage enhanced")).toBeVisible();
  });

  test("blog post editing, email, and video controls", async ({ page }) => {
    await page.goto("/blog/1");

    await expect(page.getByRole("heading", { name: "Weekly Update - Repatch" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Send Email" })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Generate Video/ })).toBeEnabled();

    await page.getByRole("button", { name: "Edit" }).click();
    const titleField = page.getByPlaceholder("Enter title...");
    await titleField.fill("Updated Weekly Update - Repatch");
    const contentField = page.getByPlaceholder("Enter patch notes content...");
    await contentField.fill("## Highlights\n- Updated via Playwright test");

    const [saveRequest] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/patch-notes/1") && res.request().method() === "PUT"
      ),
      page.getByRole("button", { name: "Save" }).click(),
    ]);
    expect(saveRequest.ok()).toBeTruthy();

    await expect(page.getByRole("heading", { name: "Updated Weekly Update - Repatch" })).toBeVisible();
    await expect(page.getByText("Updated via Playwright test")).toBeVisible();

    const dialogMessages: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    const [sendResponse] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/patch-notes/1/send") && res.request().method() === "POST"
      ),
      page.getByRole("button", { name: "Send Email" }).click(),
    ]);
    expect(sendResponse.ok()).toBeTruthy();

    await expect.poll(() => dialogMessages).toContain(
      "Send this patch note to all email subscribers?"
    );
    await expect.poll(() => dialogMessages.some((msg) => msg.includes("Patch note successfully sent"))).toBeTruthy();

    const [videoResponse] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/videos/render") && res.request().method() === "POST"
      ),
      page.getByRole("button", { name: /Generate Video/ }).click(),
    ]);
    expect(videoResponse.ok()).toBeTruthy();
  });

  test("subscribers page surfaces audience metrics", async ({ page }) => {
    await page.goto("/subscribers");

    await expect(page.getByRole("heading", { name: "Subscribers" })).toBeVisible();
    await expect(page.getByText("Total Subscribers").locator(".."))
      .toContainText("2");
    await expect(page.getByText("Active Subscribers").locator(".."))
      .toContainText("1");
    await expect(page.getByText("Unsubscribed").locator(".."))
      .toContainText("1");

    await expect(page.getByText("alice@example.com")).toBeVisible();
    await expect(page.getByText("bob@example.com")).toBeVisible();
  });
});
