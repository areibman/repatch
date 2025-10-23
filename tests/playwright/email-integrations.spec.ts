import { test, expect } from '@playwright/test';

test.describe('Email providers', () => {
  test('configures and activates providers from Subscribers page', async ({ page }) => {
    await page.route('**/api/subscribers', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          provider: 'resend',
          integration: {
            id: 'resend-env',
            provider: 'resend',
            displayName: 'Resend',
            fromEmail: 'Repatch <newsletters@example.com>',
            hasApiKey: true,
            audienceId: 'aud-old',
            metadata: {},
            isActive: true,
          },
          subscribers: [],
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    let activeProviderState: 'resend' | 'customer_io' = 'resend';

    await page.route('**/api/email-integrations', async (route, request) => {
      const method = request.method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            integrations: [
              {
                id: 'resend-env',
                provider: 'resend',
                displayName: 'Resend',
                fromEmail: 'Repatch <newsletters@example.com>',
                hasApiKey: true,
                audienceId: 'aud-old',
                metadata: {},
                isActive: activeProviderState === 'resend',
              },
              {
                id: 'customer-io-env',
                provider: 'customer_io',
                displayName: 'Customer.io',
                fromEmail: 'Repatch <newsletters@example.com>',
                hasApiKey: false,
                siteId: 'site-123',
                transactionalMessageId: null,
                metadata: { region: 'us' },
                isActive: activeProviderState === 'customer_io',
              },
            ],
            active: {
              id:
                activeProviderState === 'resend' ? 'resend-env' : 'customer-io-env',
              provider: activeProviderState,
              displayName:
                activeProviderState === 'resend' ? 'Resend' : 'Customer.io',
              fromEmail: 'Repatch <newsletters@example.com>',
              hasApiKey: true,
              audienceId:
                activeProviderState === 'resend' ? 'aud-old' : undefined,
              metadata:
                activeProviderState === 'customer_io' ? { region: 'us' } : {},
              isActive: true,
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        return;
      }

      if (method === 'PUT') {
        const payload = await request.postDataJSON();
        expect(payload.provider).toBe('resend');
        expect(payload.audienceId).toBe('aud-1234');
        expect(payload.apiKey).toBe('new-resend-key');
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            integration: {
              id: 'resend-env',
              provider: 'resend',
              displayName: 'Resend',
              fromEmail: payload.fromEmail ?? 'Repatch <newsletters@example.com>',
              hasApiKey: true,
              audienceId: payload.audienceId,
              metadata: {},
              isActive: true,
            },
            active: {
              id: 'resend-env',
              provider: 'resend',
              displayName: 'Resend',
              fromEmail: 'Repatch <newsletters@example.com>',
              hasApiKey: true,
              audienceId: payload.audienceId,
              metadata: {},
              isActive: true,
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        return;
      }

    if (method === 'PATCH') {
        const payload = await request.postDataJSON();
        expect(payload.provider).toBe('customer_io');
        activeProviderState = 'customer_io';
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            integration: {
              id: 'customer-io-env',
              provider: 'customer_io',
              displayName: 'Customer.io',
              fromEmail: 'Repatch <newsletters@example.com>',
              hasApiKey: false,
              siteId: 'site-123',
              transactionalMessageId: null,
              metadata: { region: 'us' },
              isActive: true,
            },
            active: {
              id: 'customer-io-env',
              provider: 'customer_io',
              displayName: 'Customer.io',
              fromEmail: 'Repatch <newsletters@example.com>',
              hasApiKey: false,
              siteId: 'site-123',
              transactionalMessageId: null,
              metadata: { region: 'us' },
              isActive: true,
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        return;
      }

      await route.fallback();
    });

    await page.goto('/subscribers');
    await expect(page.getByText('Email Provider')).toBeVisible();
    await expect(page.getByText('Resend')).toBeVisible();
    await expect(page.getByText('Customer.io')).toBeVisible();

    await page.getByLabel('Audience ID').fill('aud-1234');
    await page.getByLabel('Resend API Key').fill('new-resend-key');
    await page.getByRole('button', { name: 'Save settings' }).first().click();

    await expect(page.getByText('API key stored').first()).toBeVisible();

    await page.getByRole('button', { name: 'Set Active' }).click();
    await expect(page.getByText('Customer.io')).toBeVisible();
    await expect(page.locator('div', { hasText: 'Customer.io' }).getByRole('button', { name: 'Set Active' })).toHaveCount(0);
    await expect(page.locator('div', { hasText: 'Customer.io' }).getByText('Active')).toBeVisible();
  });

  test('indicates active provider when sending patch notes', async ({ page }) => {
    const patchNoteId = 'demo-note';

    await page.route(`**/api/patch-notes/${patchNoteId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: patchNoteId,
          repo_name: 'octocat/demo',
          repo_url: 'https://github.com/octocat/demo',
          time_period: '1week',
          title: 'Weekly Updates',
          content: '# Changes\n- Added tests',
          changes: { added: 10, modified: 2, removed: 1 },
          contributors: ['octocat'],
          video_url: null,
          repo_branch: 'main',
          ai_summaries: null,
          ai_overall_summary: 'A quick summary.',
          ai_detailed_contexts: null,
          ai_template_id: null,
          filter_metadata: null,
          video_top_changes: null,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.route('**/api/email-integrations/active', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          integration: {
            id: 'customer-io-env',
            provider: 'customer_io',
            displayName: 'Customer.io',
            fromEmail: 'updates@example.com',
            hasApiKey: true,
            metadata: { region: 'us' },
            isActive: true,
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.route(`**/api/patch-notes/${patchNoteId}/send`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          sentTo: 2,
          provider: {
            id: 'customer-io-env',
            provider: 'customer_io',
            displayName: 'Customer.io',
            fromEmail: 'updates@example.com',
            hasApiKey: true,
            metadata: { region: 'us' },
            isActive: true,
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.route('**/api/videos/status/**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ hasVideo: false }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.route('**/api/ai-templates', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([]),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        await dialog.accept();
      } else if (dialog.type() === 'alert') {
        expect(dialog.message()).toContain('via Customer.io');
        await dialog.accept();
      }
    });

    await page.goto(`/blog/${patchNoteId}`);
    await expect(page.getByText('Customer.io')).toBeVisible();
    await expect(page.getByText('From updates@example.com').first()).toBeVisible();

    await page.getByRole('button', { name: 'Send Email' }).click();
  });
});
