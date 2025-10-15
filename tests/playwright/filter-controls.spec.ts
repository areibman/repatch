import { expect, test } from '@playwright/test';

const repoUrl = 'https://github.com/octocat/Hello-World';

async function stubCommonRoutes(page: Parameters<typeof test>[0]['page']) {
  await page.route('**/api/patch-notes', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, body: '[]', headers: { 'content-type': 'application/json' } });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/github/branches**', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify([
        { name: 'main', protected: true },
        { name: 'develop', protected: false },
      ]),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.route('**/api/github/labels**', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify(['backend', 'frontend', 'infra']),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.route('**/api/github/tags**', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify([
        { name: 'v1.0.0', commitSha: 'abc123' },
        { name: 'v1.1.0', commitSha: 'def456' },
      ]),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.route('**/api/videos/status/**', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ hasVideo: false }),
      headers: { 'content-type': 'application/json' },
    });
  });
}

test('custom range filters are forwarded to the backend', async ({ page }) => {
  await stubCommonRoutes(page);

  await page.route('**/api/github/releases**', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify([]),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.route('**/api/github/stats', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        commits: 5,
        additions: 42,
        deletions: 10,
        contributors: ['@octocat'],
        commitMessages: ['Fix bug'],
      }),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.route('**/api/github/summarize', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        summaries: [],
        overallSummary: null,
        totalCommits: 5,
        totalAdditions: 42,
        totalDeletions: 10,
      }),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.route('**/api/patch-notes', async route => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}');
      expect(body.time_period).toBe('custom');
      expect(body.filter_metadata).toMatchObject({
        mode: 'custom',
        customRange: {
          since: '2025-01-01T00:00:00.000Z',
          until: '2025-01-08T00:00:00.000Z',
        },
        includeLabels: ['backend'],
      });
      await route.fulfill({
        status: 201,
        body: JSON.stringify({ id: '123' }),
        headers: { 'content-type': 'application/json' },
      });
    } else {
      await route.fulfill({ status: 200, body: '[]', headers: { 'content-type': 'application/json' } });
    }
  }, { times: 1 });

  await page.route('**/api/patch-notes/123', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        id: '123',
        repo_name: 'octocat/Hello-World',
        repo_url: repoUrl,
        time_period: 'custom',
        generated_at: new Date().toISOString(),
        title: 'Custom Range Update - Hello-World',
        content: '# Test',
        changes: { added: 10, modified: 0, removed: 5 },
        contributors: ['@octocat'],
        video_url: null,
        filter_metadata: {
          mode: 'custom',
          customRange: {
            since: '2025-01-01T00:00:00.000Z',
            until: '2025-01-08T00:00:00.000Z',
          },
          includeLabels: ['backend'],
        },
      }),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Create New Post' }).click();

  await page.getByLabel('Repository URL').fill(repoUrl);

  await page.getByRole('combobox', { name: 'Commit Source' }).click();
  await page.getByRole('option', { name: 'Custom Range' }).click();

  const dateInputs = page.locator('input[type="datetime-local"]');
  await dateInputs.first().fill('2025-01-01T00:00');
  await dateInputs.nth(1).fill('2025-01-08T00:00');

  const labelInput = page.getByPlaceholder('Add label and press Enter');
  await labelInput.first().fill('backend');
  await labelInput.first().press('Enter');

  await page.getByRole('button', { name: 'Create Patch Note' }).click();

  await page.waitForURL('**/blog/123');
  await expect(page.getByText('Custom Range (Jan')).toBeVisible();
});

test('release selections and tag filters are persisted', async ({ page }) => {
  await stubCommonRoutes(page);

  await page.route('**/api/github/releases**', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify([
        {
          id: 1,
          tagName: 'v1.0.0',
          name: 'v1.0.0',
          publishedAt: '2024-12-01T00:00:00.000Z',
          targetCommitish: 'main',
        },
        {
          id: 2,
          tagName: 'v1.1.0',
          name: 'v1.1.0',
          publishedAt: '2025-01-05T00:00:00.000Z',
          targetCommitish: 'main',
        },
      ]),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.route('**/api/github/stats', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        commits: 3,
        additions: 15,
        deletions: 7,
        contributors: ['@octocat'],
        commitMessages: ['Refactor modules'],
      }),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.route('**/api/github/summarize', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        summaries: [],
        overallSummary: null,
        totalCommits: 3,
        totalAdditions: 15,
        totalDeletions: 7,
      }),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.route('**/api/patch-notes', async route => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}');
      expect(body.time_period).toBe('release');
      expect(body.filter_metadata).toMatchObject({
        mode: 'release',
        releases: [
          {
            tag: 'v1.0.0',
            previousTag: null,
          },
          {
            tag: 'v1.1.0',
            previousTag: 'v1.0.0',
          },
        ],
        includeTags: ['v1.0.0'],
        excludeTags: ['legacy'],
      });
      await route.fulfill({
        status: 201,
        body: JSON.stringify({ id: 'abc' }),
        headers: { 'content-type': 'application/json' },
      });
    } else {
      await route.fulfill({ status: 200, body: '[]', headers: { 'content-type': 'application/json' } });
    }
  }, { times: 1 });

  await page.route('**/api/patch-notes/abc', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        id: 'abc',
        repo_name: 'octocat/Hello-World',
        repo_url: repoUrl,
        time_period: 'release',
        generated_at: new Date().toISOString(),
        title: 'Release Selection Update - Hello-World',
        content: '# Test',
        changes: { added: 5, modified: 0, removed: 2 },
        contributors: ['@octocat'],
        video_url: null,
        filter_metadata: {
          mode: 'release',
          releases: [
            { tag: 'v1.0.0', previousTag: null },
            { tag: 'v1.1.0', previousTag: 'v1.0.0' },
          ],
          includeTags: ['v1.0.0'],
          excludeTags: ['legacy'],
        },
      }),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Create New Post' }).click();
  await page.getByLabel('Repository URL').fill(repoUrl);

  await page.getByRole('combobox', { name: 'Commit Source' }).click();
  await page.getByRole('option', { name: 'Release Selection' }).click();

  await page.getByRole('checkbox', { name: 'v1.0.0' }).check();
  await page.getByRole('checkbox', { name: 'v1.1.0' }).check();

  const tagInputs = page.getByPlaceholder('Add tag and press Enter');
  await tagInputs.first().fill('v1.0.0');
  await tagInputs.first().press('Enter');
  await tagInputs.nth(1).fill('legacy');
  await tagInputs.nth(1).press('Enter');

  await page.getByRole('button', { name: 'Create Patch Note' }).click();
  await page.waitForURL('**/blog/abc');
  await expect(page.getByText('Release Selection (v1.0.0, v1.1.0)')).toBeVisible();
});
