import { test, expect } from '@playwright/test';

const integrationsResponse = [
  {
    provider: 'resend',
    isActive: true,
    settings: {
      audienceId: 'aud_test',
      fromEmail: 'updates@example.com',
      fromName: 'Patch Notes',
      hasApiKey: true,
    },
  },
  {
    provider: 'customerio',
    isActive: false,
    settings: {
      region: 'us',
      transactionalMessageId: '3',
      fromEmail: 'team@example.com',
      fromName: 'Product Team',
      hasAppApiKey: false,
      hasTrackCredentials: false,
    },
  },
];

test.describe('Email integrations', () => {
  test('lets admins toggle providers and persist settings', async ({ page }) => {
    await page.route('**/api/subscribers', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify([
            {
              id: '1',
              email: 'alex@example.com',
              active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]),
          headers: { 'content-type': 'application/json' },
        });
      } else {
        await route.fulfill({ status: 200, body: '{}', headers: { 'content-type': 'application/json' } });
      }
    });

    let lastRequest: any = null;

    await page.route('**/api/email-integrations', async route => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify(integrationsResponse),
          headers: { 'content-type': 'application/json' },
        });
        return;
      }

      lastRequest = JSON.parse(route.request().postData() ?? '{}');
      expect(lastRequest.provider).toBe('customerio');
      expect(lastRequest.isActive).toBe(true);
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          provider: 'customerio',
          isActive: true,
          settings: {
            region: 'us',
            transactionalMessageId: '3',
            fromEmail: 'team@example.com',
            fromName: 'Product Team',
            hasAppApiKey: true,
            hasTrackCredentials: true,
          },
        }),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.goto('/subscribers');

    await expect(page.getByText('Active provider')).toBeVisible();
    await expect(page.getByText('Your Resend defaults for patch note delivery.')).toBeVisible();

    await page.getByRole('button', { name: 'Use Customer.io' }).click();

    await expect.poll(() => lastRequest).toBeTruthy();
    await expect(page.getByText('Your Customer.io defaults for patch note delivery.')).toBeVisible();
  });

  test('displays provider on patch note send flow', async ({ page }) => {
    await page.route('**/api/patch-notes/123', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: '123',
          repo_name: 'octocat/Hello-World',
          repo_url: 'https://github.com/octocat/Hello-World',
          time_period: '1week',
          generated_at: new Date().toISOString(),
          title: 'Weekly Update',
          content: '# Patch Notes',
          changes: { added: 5, modified: 2, removed: 1 },
          contributors: ['@octocat'],
          video_url: null,
          repo_branch: 'main',
          ai_summaries: null,
          ai_overall_summary: null,
          ai_detailed_contexts: null,
          ai_template_id: null,
          filter_metadata: null,
          video_top_changes: null,
        }),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.route('**/api/videos/status/123', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ hasVideo: false }),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.route('**/api/patch-notes/123/send', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ provider: 'customerio', displayName: 'Customer.io' }),
          headers: { 'content-type': 'application/json' },
        });
        return;
      }

      await route.fulfill({
        status: 200,
        body: JSON.stringify({ sentTo: 2, provider: 'Customer.io', providerId: 'customerio' }),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.route('**/api/ai-templates', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([]),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.goto('/blog/123');

    await expect(page.getByText('Customer.io delivers this campaign')).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    const alertPromise = page.waitForEvent('dialog');
    await page.getByRole('button', { name: 'Send Email' }).click();
    const alertDialog = await alertPromise;
    expect(alertDialog.message()).toContain('Customer.io');
    await alertDialog.accept();
  });
});
