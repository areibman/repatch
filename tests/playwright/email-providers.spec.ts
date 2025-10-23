import { expect, test } from '@playwright/test';

const providerEndpoint = '**/api/email/providers';

const baseProvidersResponse = {
  providers: [
    {
      id: 'resend-id',
      provider: 'resend',
      isActive: true,
      source: 'database',
      settings: {
        apiKey: '********',
        audienceId: 'aud-123',
        fromEmail: 'updates@example.com',
        fromName: 'Repatch',
        replyTo: 'support@example.com',
      },
    },
    {
      id: 'customerio-id',
      provider: 'customerio',
      isActive: false,
      source: 'fallback',
      settings: {
        appApiKey: null,
        region: 'us',
        fromEmail: null,
        fromName: null,
      },
    },
  ],
  active: {
    id: 'resend-id',
    provider: 'resend',
    isActive: true,
    source: 'database',
    settings: {
      apiKey: '********',
      audienceId: 'aud-123',
      fromEmail: 'updates@example.com',
      fromName: 'Repatch',
      replyTo: 'support@example.com',
    },
  },
};

test.describe('email provider settings', () => {
  test('allows saving customer.io credentials', async ({ page }) => {
    let putPayload: any = null;

    await page.route(providerEndpoint, async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify(baseProvidersResponse),
          headers: { 'content-type': 'application/json' },
        });
        return;
      }

      if (route.request().method() === 'PUT') {
        putPayload = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            id: 'customerio-id',
            provider: 'customerio',
            isActive: false,
            source: 'database',
            settings: {
              appApiKey: '********',
              region: 'eu',
              fromEmail: 'hello@example.com',
              fromName: 'Team Repatch',
            },
          }),
          headers: { 'content-type': 'application/json' },
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/settings/email');

    await page.getByLabel('App API Key').fill('e4f8aa03baba5a5ba445895b74208480');
    await page.selectOption('#customerio-region', 'eu');
    await page.getByLabel('From Email').nth(1).fill('hello@example.com');
    await page.getByLabel('From Name').nth(1).fill('Team Repatch');

    await page.getByRole('button', { name: 'Save', exact: true }).nth(1).click();

    await expect(page.getByText('Provider settings saved successfully.')).toBeVisible();

    expect(putPayload).toEqual(
      expect.objectContaining({
        provider: 'customerio',
        settings: expect.objectContaining({
          appApiKey: 'e4f8aa03baba5a5ba445895b74208480',
          region: 'eu',
          fromEmail: 'hello@example.com',
          fromName: 'Team Repatch',
        }),
      })
    );
  });

  test('send email honours active provider label', async ({ page }) => {
    await page.route(providerEndpoint, async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            providers: [
              {
                id: 'customerio-id',
                provider: 'customerio',
                isActive: true,
                source: 'database',
                settings: {
                  appApiKey: '********',
                  region: 'eu',
                  fromEmail: 'hello@example.com',
                  fromName: 'Team Repatch',
                },
              },
            ],
            active: {
              id: 'customerio-id',
              provider: 'customerio',
              isActive: true,
              source: 'database',
              settings: {
                appApiKey: '********',
                region: 'eu',
                fromEmail: 'hello@example.com',
                fromName: 'Team Repatch',
              },
            },
          }),
          headers: { 'content-type': 'application/json' },
        });
        return;
      }

      await route.continue();
    });

    await page.route('**/api/patch-notes/123', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: '123',
          repo_name: 'octocat/Hello-World',
          repo_url: 'https://github.com/octocat/Hello-World',
          time_period: '1week',
          generated_at: new Date().toISOString(),
          title: 'Weekly Update',
          content: '# Changelog',
          changes: { added: 1, modified: 0, removed: 0 },
          contributors: ['@octocat'],
          video_url: null,
          filter_metadata: null,
        }),
      });
    });

    await page.route('**/api/patch-notes/123/send', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ success: true, sentTo: 5, provider: 'customerio' }),
      });
    });

    await page.route('**/api/patch-notes', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([
          {
            id: '123',
            repo_name: 'octocat/Hello-World',
            repo_url: 'https://github.com/octocat/Hello-World',
            generated_at: new Date().toISOString(),
            time_period: '1week',
            title: 'Weekly Update',
            content: '# Changelog',
            changes: { added: 1, modified: 0, removed: 0 },
            contributors: ['@octocat'],
            video_url: null,
            filter_metadata: null,
          },
        ]),
      });
    });

    await page.route('**/api/videos/status/**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hasVideo: false }),
      });
    });

    await page.goto('/');
    await page.getByRole('link', { name: 'Weekly Update' }).click();

    const dialogs: string[] = [];
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    await page.getByRole('button', { name: 'Send Email' }).click();

    expect(dialogs[0]).toContain('Customer.io');
    await expect(page.getByText('Delivered by Customer.io')).toBeVisible();
  });
});
