import { test, expect } from '@playwright/test';

test.describe('Patch note filter controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/github/branches?**', async (route) => {
      await route.fulfill({
        json: [
          { name: 'main', protected: false },
          { name: 'develop', protected: false },
        ],
      });
    });

    await page.route('**/api/github/labels?**', async (route) => {
      await route.fulfill({
        json: [
          { name: 'feature' },
          { name: 'bugfix' },
          { name: 'infra' },
        ],
      });
    });

    await page.route('**/api/github/releases?**', async (route) => {
      await route.fulfill({
        json: [
          { tag: 'v1.1.0', name: 'v1.1.0', publishedAt: '2024-02-01T00:00:00Z' },
          { tag: 'v1.0.0', name: 'v1.0.0', publishedAt: '2024-01-01T00:00:00Z' },
        ],
      });
    });
  });

  test('submits preset filters with branch selection', async ({ page }) => {
    let statsRequestBody: any;
    let summaryRequestBody: any;
    let createBody: any;

    await page.route('**/api/github/stats', async (route) => {
      statsRequestBody = await route.request().postDataJSON();
      await route.fulfill({
        json: {
          commits: 5,
          additions: 120,
          deletions: 30,
          contributors: ['@dev'],
          commitMessages: ['feat: demo change'],
          filterLabel: 'Past 7 Days',
        },
      });
    });

    await page.route('**/api/github/summarize', async (route) => {
      summaryRequestBody = await route.request().postDataJSON();
      await route.fulfill({
        json: {
          summaries: [],
          overallSummary: 'Summary text',
          totalCommits: 5,
          totalAdditions: 120,
          totalDeletions: 30,
          filterLabel: 'Past 7 Days',
          appliedFilters: summaryRequestBody?.filters,
        },
      });
    });

    await page.route('**/api/patch-notes', async (route) => {
      if (route.request().method() === 'POST') {
        createBody = await route.request().postDataJSON();
        await route.fulfill({ json: { id: 'note-1' } });
      } else {
        await route.fulfill({ json: [] });
      }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Post' }).click();
    await page.getByLabel('Repository URL').fill('https://github.com/example/repo');
    await page.getByLabel('Branch').waitFor();
    await page.getByRole('button', { name: 'Generate Patch Notes' }).click();

    await expect.poll(() => statsRequestBody).toBeTruthy();
    await expect.poll(() => createBody).toBeTruthy();

    expect(statsRequestBody.filters.mode).toBe('preset');
    expect(statsRequestBody.filters.preset).toBe('1week');
    expect(summaryRequestBody.filters.mode).toBe('preset');
    expect(createBody.filter_metadata.mode).toBe('preset');
    expect(createBody.filter_metadata.preset).toBe('1week');
  });

  test('submits custom date range filters', async ({ page }) => {
    let statsRequestBody: any;
    let createBody: any;

    await page.route('**/api/github/stats', async (route) => {
      statsRequestBody = await route.request().postDataJSON();
      await route.fulfill({
        json: {
          commits: 2,
          additions: 40,
          deletions: 10,
          contributors: ['@dev'],
          commitMessages: ['chore: update docs'],
          filterLabel: 'Custom Range (Jan 1 – Jan 7)',
        },
      });
    });

    await page.route('**/api/github/summarize', async (route) => {
      await route.fulfill({
        json: {
          summaries: [],
          overallSummary: 'Summary text',
          totalCommits: 2,
          totalAdditions: 40,
          totalDeletions: 10,
          filterLabel: 'Custom Range (Jan 1 – Jan 7)',
        },
      });
    });

    await page.route('**/api/patch-notes', async (route) => {
      if (route.request().method() === 'POST') {
        createBody = await route.request().postDataJSON();
        await route.fulfill({ json: { id: 'note-2' } });
      } else {
        await route.fulfill({ json: [] });
      }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Post' }).click();
    await page.getByLabel('Repository URL').fill('https://github.com/example/repo');
    await page.getByLabel('Branch').waitFor();

    await page.getByLabel('Commit source').click();
    await page.getByRole('option', { name: 'Custom date range' }).click();

    const startInput = page.getByLabel('Start');
    const endInput = page.getByLabel('End');
    await startInput.fill('2024-01-01');
    await endInput.fill('2024-01-07');

    await page.getByRole('button', { name: 'Generate Patch Notes' }).click();

    await expect.poll(() => statsRequestBody).toBeTruthy();
    await expect.poll(() => createBody).toBeTruthy();

    expect(statsRequestBody.filters.mode).toBe('custom');
    expect(statsRequestBody.filters.customRange.since).toContain('2024-01-01');
    expect(statsRequestBody.filters.customRange.until).toContain('2024-01-07');
    expect(createBody.filter_metadata.mode).toBe('custom');
    expect(createBody.filter_metadata.customRange.since).toContain('2024-01-01');
    expect(createBody.filter_metadata.customRange.until).toContain('2024-01-07');
  });

  test('submits release comparisons with label filters', async ({ page }) => {
    let statsRequestBody: any;
    let createBody: any;

    await page.route('**/api/github/stats', async (route) => {
      statsRequestBody = await route.request().postDataJSON();
      await route.fulfill({
        json: {
          commits: 8,
          additions: 200,
          deletions: 50,
          contributors: ['@dev'],
          commitMessages: ['feat: big launch'],
          filterLabel: 'Releases v1.0.0 → v1.1.0',
        },
      });
    });

    await page.route('**/api/github/summarize', async (route) => {
      await route.fulfill({
        json: {
          summaries: [],
          overallSummary: 'Summary text',
          totalCommits: 8,
          totalAdditions: 200,
          totalDeletions: 50,
          filterLabel: 'Releases v1.0.0 → v1.1.0',
        },
      });
    });

    await page.route('**/api/patch-notes', async (route) => {
      if (route.request().method() === 'POST') {
        createBody = await route.request().postDataJSON();
        await route.fulfill({ json: { id: 'note-3' } });
      } else {
        await route.fulfill({ json: [] });
      }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Post' }).click();
    await page.getByLabel('Repository URL').fill('https://github.com/example/repo');
    await page.getByLabel('Branch').waitFor();

    await page.getByLabel('Commit source').click();
    await page.getByRole('option', { name: 'Compare releases' }).click();

    await page.getByLabel('Target release').click();
    await page.getByRole('option', { name: /v1.1.0/ }).click();

    await page.getByLabel('Compare against').click();
    await page.getByRole('option', { name: /v1.0.0/ }).click();

    // Include and exclude label filters
    await page.getByLabel('feature', { exact: true }).first().check();
    await page.getByLabel('bugfix', { exact: true }).last().check();

    await page.getByRole('button', { name: 'Generate Patch Notes' }).click();

    await expect.poll(() => statsRequestBody).toBeTruthy();
    await expect.poll(() => createBody).toBeTruthy();

    expect(statsRequestBody.filters.mode).toBe('release');
    expect(statsRequestBody.filters.releaseRange.headTag).toBe('v1.1.0');
    expect(statsRequestBody.filters.releaseRange.baseTag).toBe('v1.0.0');
    expect(statsRequestBody.filters.includeLabels).toContain('feature');
    expect(statsRequestBody.filters.excludeLabels).toContain('bugfix');

    expect(createBody.filter_metadata.mode).toBe('release');
    expect(createBody.filter_metadata.releaseRange.headTag).toBe('v1.1.0');
    expect(createBody.filter_metadata.releaseRange.baseTag).toBe('v1.0.0');
    expect(new Set(createBody.filter_metadata.includeLabels)).toContain('feature');
    expect(new Set(createBody.filter_metadata.excludeLabels)).toContain('bugfix');
  });
});
