import { test, expect } from '@playwright/test';

test.describe('Patch note filter workflow', () => {
  test('submits a custom date range with metadata', async ({ page }) => {
    await page.route('**/api/github/branches?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ name: 'main', protected: false }]),
      })
    );

    await page.route('**/api/github/releases?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    const expectedSince = new Date('2024-01-01T09:00').toISOString();
    const expectedUntil = new Date('2024-01-07T18:00').toISOString();

    await page.route('**/api/github/stats?**', async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get('since')).toBe(expectedSince);
      expect(url.searchParams.get('until')).toBe(expectedUntil);
      expect(url.searchParams.get('timePeriod')).toBeNull();
      expect(url.searchParams.get('releaseTag')).toBeNull();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          commits: 2,
          additions: 18,
          deletions: 4,
          contributors: ['@octocat'],
          commitMessages: ['feat: ship filters', 'fix: tidy styles'],
          timePeriod: 'custom',
          contextLabel: 'Custom Range (2024-01-01 – 2024-01-07)',
          releaseBaseTag: null,
        }),
      });
    });

    await page.route('**/api/github/summarize', async (route) => {
      const body = route.request().postDataJSON() as any;
      expect(body.filters).toBeDefined();
      expect(body.filters.customRange?.since).toBe(expectedSince);
      expect(body.filters.customRange?.until).toBe(expectedUntil);
      expect(body.filters.releaseTag).toBeUndefined();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summaries: [
            {
              sha: 'abc123',
              message: 'feat: ship filters',
              aiSummary: 'Adds filter controls',
              additions: 10,
              deletions: 2,
            },
          ],
          overallSummary: 'Delivered configurable patch notes.',
          totalAdditions: 10,
          totalDeletions: 2,
          timePeriod: 'custom',
          contextLabel: 'Custom Range (2024-01-01 – 2024-01-07)',
        }),
      });
    });

    await page.route('**/api/patch-notes', async (route) => {
      const payload = route.request().postDataJSON() as any;
      expect(payload.time_period).toBe('custom');
      expect(payload.filters?.customRange?.since).toBe(expectedSince);
      expect(payload.filters?.customRange?.until).toBe(expectedUntil);
      expect(payload.filters?.branch).toBe('main');

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'note-123' }),
      });
    });

    await page.route('**/blog/note-123', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>ok</body></html>',
      })
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Post' }).click();
    await page.getByLabel('Repository URL').fill('https://github.com/test/repo');

    await page.getByLabel('Use custom date range').check();
    await page.getByLabel('Start').fill('2024-01-01T09:00');
    await page.getByLabel('End').fill('2024-01-07T18:00');

    await page.getByRole('button', { name: 'Create Patch Note' }).click();
    await page.waitForURL('**/blog/note-123');
  });

  test('applies include/exclude tag filters when fetching stats', async ({ page }) => {
    await page.route('**/api/github/branches?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ name: 'main', protected: false }]),
      })
    );

    await page.route('**/api/github/releases?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await page.route('**/api/github/stats?**', async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get('includeTags')).toBe('feature,bug');
      expect(url.searchParams.get('excludeTags')).toBe('chore');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          commits: 1,
          additions: 8,
          deletions: 1,
          contributors: ['@octocat'],
          commitMessages: ['feat: add filters'],
          timePeriod: '1week',
          contextLabel: 'Weekly Update',
          releaseBaseTag: null,
        }),
      });
    });

    await page.route('**/api/github/summarize', async (route) => {
      const body = route.request().postDataJSON() as any;
      expect(body.filters?.includeTags).toEqual(['feature', 'bug']);
      expect(body.filters?.excludeTags).toEqual(['chore']);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ summaries: [], overallSummary: 'Summary', totalAdditions: 0, totalDeletions: 0 }),
      });
    });

    await page.route('**/api/patch-notes', async (route) => {
      const payload = route.request().postDataJSON() as any;
      expect(payload.filters?.includeTags).toEqual(['feature', 'bug']);
      expect(payload.filters?.excludeTags).toEqual(['chore']);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'note-234' }),
      });
    });

    await page.route('**/blog/note-234', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>ok</body></html>',
      })
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Post' }).click();
    await page.getByLabel('Repository URL').fill('https://github.com/test/repo');

    await page.getByLabel('Include commits with labels').fill('feature, bug');
    await page.getByLabel('Exclude commits with labels').fill('chore');

    await page.getByRole('button', { name: 'Create Patch Note' }).click();
    await page.waitForURL('**/blog/note-234');
  });

  test('selecting a release triggers release-specific filters', async ({ page }) => {
    await page.route('**/api/github/branches?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ name: 'main', protected: false }]),
      })
    );

    await page.route('**/api/github/releases?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, tag_name: 'v1.1.0', name: 'v1.1.0', published_at: '2024-02-01T00:00:00Z', draft: false, prerelease: false },
          { id: 2, tag_name: 'v1.0.0', name: 'v1.0.0', published_at: '2024-01-01T00:00:00Z', draft: false, prerelease: false },
        ]),
      })
    );

    await page.route('**/api/github/stats?**', async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get('releaseTag')).toBe('v1.1.0');
      expect(url.searchParams.get('since')).toBeNull();
      expect(url.searchParams.get('timePeriod')).toBeNull();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          commits: 3,
          additions: 42,
          deletions: 5,
          contributors: ['@octocat'],
          commitMessages: ['feat: release'],
          timePeriod: 'release',
          contextLabel: 'Release v1.1.0',
          releaseBaseTag: 'v1.0.0',
        }),
      });
    });

    await page.route('**/api/github/summarize', async (route) => {
      const body = route.request().postDataJSON() as any;
      expect(body.filters?.releaseTag).toBe('v1.1.0');
      expect(body.filters?.customRange).toBeUndefined();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ summaries: [], overallSummary: 'Release summary', totalAdditions: 0, totalDeletions: 0 }),
      });
    });

    await page.route('**/api/patch-notes', async (route) => {
      const payload = route.request().postDataJSON() as any;
      expect(payload.time_period).toBe('release');
      expect(payload.filters?.releaseTag).toBe('v1.1.0');
      expect(payload.filters?.releaseBaseTag).toBe('v1.0.0');

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'note-345' }),
      });
    });

    await page.route('**/blog/note-345', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>ok</body></html>',
      })
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Post' }).click();
    await page.getByLabel('Repository URL').fill('https://github.com/test/repo');

    await page.getByLabel('Release (optional)').click();
    await page.getByRole('option', { name: 'v1.1.0' }).click();

    await page.getByRole('button', { name: 'Create Patch Note' }).click();
    await page.waitForURL('**/blog/note-345');
  });
});
