import { test, expect } from "@playwright/test";

test("users can select templates and regenerate summaries", async ({ page }) => {
  const templates = [
    {
      id: "tech-template",
      name: "Technical Digest",
      description: "Precise engineering updates",
      narrative_type: "technical",
      commit_prompt: "",
      overall_prompt: "",
      examples: [
        {
          title: "Optimize queries",
          input: "Commit simplifies SQL joins",
          output: "Reduced query fan-out for faster dashboards",
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "lead-template",
      name: "Leadership Brief",
      description: "Executive ready summary",
      narrative_type: "non-technical",
      commit_prompt: "",
      overall_prompt: "",
      examples: [
        {
          title: "Streamline onboarding",
          input: "Rebuild the onboarding flow",
          output: "Onboarding is now a single step for new users",
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  let creationRequestBody: any | null = null;
  let updateRequestBody: any | null = null;

  await page.route("**/api/ai-templates", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(templates),
        headers: { "Content-Type": "application/json" },
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/patch-notes", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([]),
        headers: { "Content-Type": "application/json" },
      });
      return;
    }

    if (route.request().method() === "POST") {
      creationRequestBody = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        body: JSON.stringify({
          id: "note-1",
          ...creationRequestBody,
        }),
        headers: { "Content-Type": "application/json" },
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/patch-notes/note-1", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: "note-1",
          repo_name: "acme/widgets",
          repo_url: "https://github.com/acme/widgets",
          time_period: "1week",
          generated_at: new Date().toISOString(),
          title: "Weekly Update - widgets",
          content: "Leadership headline.\n\n## Key Changes\n\n### Added welcome flow\nSimplified signup journey\n\n**Changes:** +12 -2 lines",
          changes: { added: 12, modified: 0, removed: 2 },
          contributors: ["@ada"],
          video_url: null,
          video_data: null,
          ai_summaries: [
            {
              sha: "abc",
              message: "Add welcome flow",
              aiSummary: "Simplified signup journey",
              additions: 12,
              deletions: 2,
            },
          ],
          ai_overall_summary: "Leadership headline.",
          ai_template_id: "lead-template",
        }),
        headers: { "Content-Type": "application/json" },
      });
      return;
    }

    if (route.request().method() === "PUT") {
      updateRequestBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: "note-1",
          title: "Weekly Update - widgets",
          content: updateRequestBody.content,
          ai_summaries: updateRequestBody.ai_summaries,
          ai_overall_summary: updateRequestBody.ai_overall_summary,
          ai_template_id: updateRequestBody.ai_template_id,
        }),
        headers: { "Content-Type": "application/json" },
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/videos/status/note-1", async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ hasVideo: false }),
      headers: { "Content-Type": "application/json" },
    });
  });

  await page.route("**/api/github/branches**", async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify([{ name: "main", protected: true }]),
      headers: { "Content-Type": "application/json" },
    });
  });

  await page.route("**/api/github/stats**", async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        commits: 3,
        additions: 120,
        deletions: 40,
        contributors: ["@ada"],
        commitMessages: ["Add welcome flow"],
      }),
      headers: { "Content-Type": "application/json" },
    });
  });

  const summaryResponses = {
    leadership: {
      summaries: [
        {
          sha: "abc",
          message: "Add welcome flow",
          aiSummary: "Simplified signup journey",
          additions: 12,
          deletions: 2,
        },
      ],
      overallSummary: "Leadership headline.",
      totalCommits: 3,
      totalAdditions: 120,
      totalDeletions: 40,
    },
    technical: {
      summaries: [
        {
          sha: "abc",
          message: "Add welcome flow",
          aiSummary: "Introduced single screen onboarding",
          additions: 12,
          deletions: 2,
        },
      ],
      overallSummary: "Technical headline.",
      totalCommits: 3,
      totalAdditions: 120,
      totalDeletions: 40,
    },
  } as const;

  await page.route("**/api/github/summarize", async (route) => {
    const body = route.request().postDataJSON();
    if (body.templateId === "tech-template") {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(summaryResponses.technical),
        headers: { "Content-Type": "application/json" },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      body: JSON.stringify(summaryResponses.leadership),
      headers: { "Content-Type": "application/json" },
    });
  });

  await page.goto("/");

  await page.getByRole("button", { name: "Create New Post" }).click();

  await expect(page.getByTestId("template-select")).toBeVisible();

  await page.getByPlaceholder("https://github.com/owner/repository").fill(
    "https://github.com/acme/widgets"
  );

  // Select the leadership template
  await page.getByTestId("template-select").click();
  await page.getByRole("option", { name: /Leadership Brief/ }).click();

  await expect(page.getByTestId("template-preview")).toContainText(
    "Executive ready summary"
  );

  await page.getByRole("button", { name: "Create Patch Note" }).click();

  await expect.poll(() => creationRequestBody?.ai_template_id).toBe("lead-template");

  await page.waitForURL("/blog/note-1");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Weekly Update");
  await expect(page.getByTestId("patch-note-content")).toContainText("Leadership headline.");

  // Ensure template select on detail page shows the saved template
  await expect(page.getByTestId("detail-template-select")).toContainText("Leadership Brief");

  // Switch to technical template and regenerate
  await page.getByTestId("detail-template-select").click();
  await page.getByRole("option", { name: /Technical Digest/ }).click();
  await page.getByRole("button", { name: "Regenerate summary" }).click();

  await expect.poll(() => updateRequestBody?.ai_template_id).toBe("tech-template");
  await expect(page.getByTestId("patch-note-content")).toContainText("Technical headline.");
  await expect(page.getByTestId("patch-note-content")).toContainText(
    "Introduced single screen onboarding"
  );
});
