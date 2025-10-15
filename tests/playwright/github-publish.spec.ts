import { test, expect } from '@playwright/test';
import type { Database } from '@/lib/supabase/database.types';

test.describe('GitHub publishing workflow', () => {
  const basePatchNote: DatabaseRow = {
    id: 'test-note',
    repo_name: 'octocat/repatch',
    repo_url: 'https://github.com/octocat/repatch',
    time_period: '1week',
    generated_at: '2024-12-01T00:00:00.000Z',
    title: 'Weekly Update',
    content: '## Summary\n\n- Feature work',
    changes: { added: 12, modified: 0, removed: 4 },
    contributors: ['octocat'],
    video_data: null,
    video_url: null,
    ai_summaries: null,
    ai_overall_summary: null,
    github_publish_status: 'idle',
    github_publish_error: null,
    github_release_id: null,
    github_release_url: null,
    github_discussion_id: null,
    github_discussion_url: null,
    github_published_at: null,
    created_at: '2024-12-01T00:00:00.000Z',
    updated_at: '2024-12-01T00:00:00.000Z',
  };

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/patch-notes/test-note', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(basePatchNote),
        contentType: 'application/json',
      });
    });

    await page.route('**/api/videos/status/test-note', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ hasVideo: false }),
        contentType: 'application/json',
      });
    });
  });

  test('publishes a release and discussion with success state', async ({ page }) => {
    const publishedAt = new Date().toISOString();
    await page.route('**/api/patch-notes/test-note/publish/github', async (route) => {
      const updated = {
        ...basePatchNote,
        github_publish_status: 'succeeded',
        github_release_id: '1001',
        github_release_url: 'https://github.com/octocat/repatch/releases/tag/v1.0.0',
        github_discussion_id: '2002',
        github_discussion_url: 'https://github.com/octocat/repatch/discussions/2002',
        github_published_at: publishedAt,
        updated_at: publishedAt,
      } satisfies DatabaseRow;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'succeeded', patchNote: updated }),
      });
    });

    await page.goto('/blog/test-note');

    await expect(page.getByRole('heading', { level: 1, name: 'Weekly Update' })).toBeVisible();

    await page.getByRole('combobox', { name: 'Select publish target' }).click();
    await page.getByRole('option', { name: 'Release + Discussion' }).click();
    await page.getByPlaceholder('Discussion category (slug or name)').fill('announcements');

    await page.getByRole('button', { name: 'Publish to GitHub' }).click();

    await expect(page.getByText('Published to GitHub')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View GitHub release' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View GitHub discussion' })).toBeVisible();
  });

  test('shows failure message when GitHub publish fails', async ({ page }) => {
    await page.route('**/api/patch-notes/test-note/publish/github', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Mock GitHub failure' }),
      });
    });

    await page.goto('/blog/test-note');

    await page.getByRole('button', { name: 'Publish to GitHub' }).click();

    await expect(page.getByText('Publish to GitHub failed')).toBeVisible();
    await expect(page.getByText('Mock GitHub failure')).toBeVisible();
  });
});

type DatabaseRow = Database['public']['Tables']['patch_notes']['Row'];
