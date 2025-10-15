import { expect, test } from "@playwright/test";

const audienceSupabaseHeaders = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
  } as const;
};

test.describe("Integration configuration", () => {
  test("saves GitHub credentials and records metadata", async ({ page, context }) => {
    const supabaseConfig = audienceSupabaseHeaders();
    test.skip(!supabaseConfig, "Supabase REST credentials are required for this test.");

    const repoUrl = `https://github.com/mock-org/github-config-${Date.now()}`;
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Sources & Integrations" })).toBeVisible();

    await page.getByRole("link", { name: /^Connect$/ }).first().click();
    await expect(page).toHaveURL(/\/integrations\/github\/configure/);

    await page.getByPlaceholder("https://github.com/owner/repo").fill(repoUrl);
    await page.getByPlaceholder("ghp_").fill("ghp_mock_token");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("alert")).toHaveCount(0);

    const { url, headers } = supabaseConfig!;
    const response = await context.request.get(
      `${url}/rest/v1/github_configs?repo_url=eq.${encodeURIComponent(repoUrl)}`,
      { headers }
    );

    expect(response.ok()).toBeTruthy();
    const data = (await response.json()) as Array<{ id: string }>;
    expect(data.length).toBe(1);

    await context.request.delete(
      `${url}/rest/v1/github_configs?repo_url=eq.${encodeURIComponent(repoUrl)}`,
      { headers }
    );
  });
});
