import { test, expect } from '@playwright/test';
import { DEFAULT_TEMPLATE_EXAMPLES } from '@/lib/templates';

test.describe('AI templates', () => {
  test('creates a patch note with the selected template', async ({ page }) => {
    const templates = [
      {
        id: 'technical-template',
        name: 'Technical Deep Dive',
        description: 'Engineering tone',
        audience: 'technical',
        commitPrompt: 'Keep it technical.',
        overallPrompt: 'Summarize the sprint.',
        examples: {
          sectionHeading: 'Engineering Highlights',
          overview: 'We focused on performance.',
          commits: [
            { title: 'Cache tuning', summary: 'Improved cache TTL.' },
            { title: 'CI updates', summary: 'Faster builds.' },
          ],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'product-template',
        name: 'Product Pulse',
        description: 'Stakeholder friendly',
        audience: 'non-technical',
        commitPrompt: 'Explain the customer benefit.',
        overallPrompt: 'Share what customers can expect.',
        examples: {
          sectionHeading: 'What Shipped',
          overview: 'Here is what changed for customers.',
          commits: [
            { title: 'Guided onboarding', summary: 'Simplified setup experience.' },
            { title: 'Faster exports', summary: 'Reports download quicker.' },
          ],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    await page.route('**/api/patch-notes', async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: '[]',
          headers: { 'Content-Type': 'application/json' },
        });
        return;
      }

      const body = JSON.parse(request.postData() ?? '{}');
      expect(body.ai_template_id).toBe('product-template');
      expect(body.content).toContain('## What Shipped');
      await route.fulfill({
        status: 201,
        body: JSON.stringify({ id: 'new-note' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.route('**/api/ai-templates', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(templates),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.route('**/api/github/branches**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([{ name: 'main', protected: false }]),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.route('**/api/github/stats**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          additions: 120,
          deletions: 30,
          commits: 5,
          contributors: ['alex'],
          commitMessages: ['feat: new onboarding'],
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.route('**/api/github/summarize', async (route, request) => {
      const body = JSON.parse(request.postData() ?? '{}');
      expect(body.templateId).toBe('product-template');
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          summaries: [
            {
              sha: '1',
              message: 'feat: new onboarding',
              aiSummary: 'Guided setup for teams.',
              additions: 80,
              deletions: 10,
            },
          ],
          overallSummary: 'Customers get a friendly onboarding.',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.route('**/blog/new-note', async (route) => {
      await route.fulfill({
        status: 200,
        body: '<html><body>redirected</body></html>',
        headers: { 'Content-Type': 'text/html' },
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Post' }).click();
    await page.getByLabel('Repository URL').fill('https://github.com/example/repo');
    await page.waitForTimeout(50);
    await page.getByTestId('template-select').click();
    await page.getByRole('option', { name: /Product Pulse/ }).click();
    await page.getByRole('button', { name: 'Create Patch Note' }).click();

    await page.waitForURL('**/blog/new-note');
  });

  test('regenerates a patch note with a different template', async ({ page }) => {
    const templates = [
      {
        id: 'technical-template',
        name: 'Technical Deep Dive',
        description: 'Engineering tone',
        audience: 'technical',
        commitPrompt: 'Keep it technical.',
        overallPrompt: 'Summarize the sprint.',
        examples: DEFAULT_TEMPLATE_EXAMPLES,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'product-template',
        name: 'Product Pulse',
        description: 'Stakeholder friendly',
        audience: 'non-technical',
        commitPrompt: 'Explain the customer benefit.',
        overallPrompt: 'Share what customers can expect.',
        examples: {
          sectionHeading: 'What Shipped',
          overview: 'Here is what changed for customers.',
          commits: [
            { title: 'Guided onboarding', summary: 'Simplified setup experience.' },
          ],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    await page.route('**/api/ai-templates', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(templates),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.route('**/api/patch-notes/test-note', async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            id: 'test-note',
            repo_name: 'example/repo',
            repo_url: 'https://github.com/example/repo',
            repo_branch: 'main',
            time_period: '1week',
            generated_at: new Date().toISOString(),
            title: 'Weekly Update',
            content: 'Original content',
            changes: { added: 10, modified: 0, removed: 2 },
            contributors: ['alex'],
            video_url: 'https://example.com/video.mp4',
            ai_summaries: null,
            ai_overall_summary: null,
            ai_template_id: 'technical-template',
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        return;
      }

      const body = JSON.parse(request.postData() ?? '{}');
      expect(body.ai_template_id).toBe('product-template');
      expect(body.content).toContain('## What Shipped');
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ repo_branch: body.repo_branch }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.route('**/api/github/summarize', async (route, request) => {
      const body = JSON.parse(request.postData() ?? '{}');
      expect(body.templateId).toBe('product-template');
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          summaries: [
            {
              sha: '1',
              message: 'feat: new onboarding',
              aiSummary: 'Guided setup for teams.',
              additions: 80,
              deletions: 10,
            },
          ],
          overallSummary: 'Customers get a friendly onboarding.',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.goto('/blog/test-note');
    await page.getByTestId('detail-template-select').click();
    await page.getByRole('option', { name: /Product Pulse/ }).click();
    await page.getByTestId('regenerate-template-button').click();

    await expect(page.getByTestId('regenerate-template-button')).toContainText('Regenerating');
  });
});
