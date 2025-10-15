import { test, expect } from "@playwright/test";

type PatchNoteApi = {
  id: string;
  repo_name: string;
  repo_url: string;
  time_period: "1day" | "1week" | "1month";
  generated_at: string;
  title: string;
  content: string;
  changes: { added: number; modified: number; removed: number };
  contributors: string[];
  video_url: string | null;
  video_data?: {
    langCode: string;
    topChanges: Array<{ title: string; description: string }>;
    allChanges: string[];
  };
};

type SubscriberApi = {
  id: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const listPatchNotes: PatchNoteApi[] = [
  {
    id: "patch-1",
    repo_name: "openai/repatch",
    repo_url: "https://github.com/openai/repatch",
    time_period: "1week",
    generated_at: "2025-01-10T09:30:00.000Z",
    title: "Weekly Update - Repatch",
    content: "## Summary\n\n- Fresh UI polish\n- Supabase sync improvements",
    changes: { added: 120, modified: 40, removed: 12 },
    contributors: ["alice", "bob"],
    video_url: null,
    video_data: {
      langCode: "en",
      topChanges: [
        { title: "Fresh UI polish", description: "Updated landing page cards." },
        { title: "Supabase sync", description: "Improved background job reliability." },
      ],
      allChanges: [
        "Fresh UI polish: Updated landing page cards.",
        "Supabase sync: Improved background job reliability.",
      ],
    },
  },
  {
    id: "patch-2",
    repo_name: "openai/repatch",
    repo_url: "https://github.com/openai/repatch",
    time_period: "1month",
    generated_at: "2024-12-15T16:00:00.000Z",
    title: "Monthly Stability Roundup",
    content: "Highlights from the past month",
    changes: { added: 980, modified: 120, removed: 400 },
    contributors: ["carol"],
    video_url: "https://cdn.example.com/videos/patch-2.mp4",
  },
];

test.describe("Repatch end-to-end", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/patch-notes", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({ json: listPatchNotes });
        return;
      }
      await route.continue();
    });
  });

  test("home dashboard through blog management workflow", async ({ page }) => {
    const blogNote: PatchNoteApi = {
      ...listPatchNotes[0],
      video_url: null,
    };

    await page.route("**/api/patch-notes/patch-1", async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        await route.fulfill({ json: blogNote });
        return;
      }

      if (request.method() === "PUT") {
        const body = JSON.parse(request.postData() ?? "{}");
        expect(body.title).toBe("Weekly Update - Repatch (Edited)");
        expect(body.content).toContain("Edited details");
        await route.fulfill({ json: { ...blogNote, title: body.title, content: body.content } });
        return;
      }

      await route.continue();
    });

    await page.route("**/api/patch-notes/patch-1/send", async (route) => {
      expect(route.request().method()).toBe("POST");
      await route.fulfill({ json: { sentTo: 42 } });
    });

    await page.route("**/api/videos/status/patch-1", async (route) => {
      await route.fulfill({ json: { hasVideo: false } });
    });

    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    await page.goto("/");

    await expect(page.getByText("AI-generated patch notes from your repositories")).toBeVisible();

    const totalPostsCard = page.locator('[data-slot="card"]').filter({ hasText: "Total Posts" }).first();
    await expect(totalPostsCard).toContainText("2");

    const repositoriesCard = page.locator('[data-slot="card"]').filter({ hasText: "Repositories" }).first();
    await expect(repositoriesCard).toContainText("1");

    const thisMonthCard = page.locator('[data-slot="card"]').filter({ hasText: "This Month" }).first();
    await expect(thisMonthCard).toContainText("1");

    await expect(page.getByText("Weekly Update - Repatch")).toBeVisible();
    await expect(page.getByText("Monthly Stability Roundup")).toBeVisible();

    await page.getByRole("link", { name: /Weekly Update - Repatch/ }).click();
    await expect(page).toHaveURL(/\/blog\/patch-1$/);

    await expect(page.locator("h1")).toHaveText("Weekly Update - Repatch");
    await expect(page.getByText("Checking for video", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByPlaceholder("Enter title...").fill("Weekly Update - Repatch (Edited)");
    await page.getByPlaceholder("Enter patch notes content...").fill("Edited details with refined summary.");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.locator("h1")).toHaveText("Weekly Update - Repatch (Edited)");
    await expect(page.locator(".prose")).toContainText("Edited details");

    await page.getByRole("button", { name: "Send Email" }).click();
    await expect.poll(() => dialogs.length).toBe(2);
    expect(dialogs[0]).toContain("Send this patch note to all email subscribers?");
    expect(dialogs[1]).toContain("Patch note successfully sent to 42 subscribers");
  });

  test("create new patch note from GitHub flow", async ({ page }) => {
    const summaryPayload = {
      summaries: [
        {
          sha: "abc123",
          message: "Merge pull request #123\nImprove onboarding",
          aiSummary: "Streamlined the onboarding wizard with better defaults.",
          additions: 75,
          deletions: 12,
        },
        {
          sha: "def456",
          message: "Fix analytics exports",
          aiSummary: "Resolved CSV export bug and added tests.",
          additions: 32,
          deletions: 10,
        },
      ],
      overallSummary: "Major improvements to onboarding and analytics reliability.",
    };

    await page.route("**/api/github/branches?**", async (route) => {
      await route.fulfill({
        json: [
          { name: "main", protected: true },
          { name: "develop", protected: false },
        ],
      });
    });

    await page.route("**/api/github/stats?**", async (route) => {
      await route.fulfill({
        json: {
          commits: 8,
          additions: 210,
          deletions: 45,
          contributors: ["alice", "bob"],
          commitMessages: [
            "Improve onboarding flow",
            "Fix analytics exports",
            "Refine dark mode",
          ],
        },
      });
    });

    await page.route("**/api/github/summarize", async (route) => {
      await route.fulfill({ json: summaryPayload });
    });

    let createdPayload: any = null;
    await page.route("**/api/patch-notes", async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        createdPayload = JSON.parse(request.postData() ?? "{}");
        await route.fulfill({ status: 201, json: { id: "patch-new" } });
        return;
      }
      await route.fulfill({ json: listPatchNotes });
    });

    await page.route("**/api/patch-notes/patch-new", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: {
            id: "patch-new",
            repo_name: "openai/repatch",
            repo_url: "https://github.com/openai/repatch",
            time_period: "1month",
            generated_at: new Date().toISOString(),
            title: "Monthly Update - repatch",
            content: "Generated patch note from the AI workflow.",
            changes: { added: 210, modified: 0, removed: 45 },
            contributors: ["alice", "bob"],
            video_url: "https://cdn.example.com/videos/patch-new.mp4",
          },
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Create New Post" }).click();

    await page.getByLabel("Repository URL").fill("https://github.com/openai/repatch");
    await expect(page.getByText("Fetching branches...")).toBeVisible();
    await expect(page.getByText("2 branches found", { exact: false })).toBeVisible();

    await page.getByLabel("Branch").click();
    await page.getByRole("option", { name: "develop" }).click();

    await page.getByLabel("Time Period").click();
    await page.getByRole("option", { name: "Last Month" }).click();

    await page.getByRole("button", { name: "Create Patch Note" }).click();

    await expect.poll(() => createdPayload).not.toBeNull();
    expect(createdPayload.repo_name).toBe("openai/repatch");
    expect(createdPayload.time_period).toBe("1month");
    expect(Array.isArray(createdPayload.contributors)).toBeTruthy();
    expect(createdPayload.video_data.topChanges.length).toBeGreaterThan(0);

    await expect(page).toHaveURL(/\/blog\/patch-new$/);
    await expect(page.locator("h1")).toHaveText("Monthly Update - repatch");
    await expect(page.getByText("✓ Custom Video")).toBeVisible();
  });

  test("subscriber management overview", async ({ page }) => {
    const subscribers: SubscriberApi[] = [
      {
        id: "sub-1",
        email: "alpha@example.com",
        active: true,
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "sub-2",
        email: "beta@example.com",
        active: false,
        created_at: "2025-01-02T00:00:00.000Z",
        updated_at: "2025-01-02T00:00:00.000Z",
      },
    ];

    await page.route("**/api/subscribers", async (route) => {
      await route.fulfill({ json: subscribers });
    });

    await page.goto("/subscribers");

    await expect(page.getByText("Manage your patch notes newsletter subscribers")).toBeVisible();
    await expect(page.getByText("Total Subscribers").locator(".."))
      .toContainText("2");
    await expect(page.getByText("Active Subscribers").locator(".."))
      .toContainText("1");
    await expect(page.getByText("Unsubscribed").locator(".."))
      .toContainText("1");

    await expect(page.getByText("alpha@example.com")).toBeVisible();
    await expect(page.getByText("beta@example.com")).toBeVisible();
    await expect(page.getByText("Unsubscribed")).toBeVisible();
  });
});
