import { test, expect } from '@playwright/test';

type PatchNoteFixture = {
  id: string;
  repoName: string;
  repoUrl: string;
  timePeriod: '1day' | '1week' | '1month';
  generatedAt: string;
  title: string;
  content: string;
  changes: { added: number; modified: number; removed: number };
  contributors: string[];
  videoUrl?: string | null;
  videoData?: {
    langCode: string;
    topChanges: Array<{ title: string; description: string }>;
    allChanges: string[];
  };
};

const existingPatchNotes: PatchNoteFixture[] = [
  {
    id: 'patch-1',
    repoName: 'openai/repatch',
    repoUrl: 'https://github.com/openai/repatch',
    timePeriod: '1week',
    generatedAt: new Date('2024-06-15T12:00:00Z').toISOString(),
    title: 'Weekly Update - Core Enhancements',
    content: '# Summary\n\n- Added support for AI summaries\n- Improved Supabase sync reliability\n- Refined UI polish across the app',
    changes: { added: 1420, modified: 230, removed: 320 },
    contributors: ['alice', 'bob', 'carol'],
    videoUrl: 'https://videos.example.com/patch-1.mp4',
    videoData: {
      langCode: 'en',
      topChanges: [
        { title: 'AI summarizer', description: 'First pass integration' },
        { title: 'UI refresh', description: 'Improved layout for cards' },
      ],
      allChanges: ['Added editing flow', 'Improved Supabase error reporting'],
    },
  },
  {
    id: 'patch-2',
    repoName: 'openai/repatch',
    repoUrl: 'https://github.com/openai/repatch',
    timePeriod: '1month',
    generatedAt: new Date('2024-06-01T10:00:00Z').toISOString(),
    title: 'Monthly Recap - Foundation',
    content: 'Highlights from the last month including infrastructure and design system updates.',
    changes: { added: 2420, modified: 120, removed: 1120 },
    contributors: ['dave'],
    videoUrl: null,
  },
];

function toApiPatchNote(note: PatchNoteFixture) {
  return {
    id: note.id,
    repo_name: note.repoName,
    repo_url: note.repoUrl,
    time_period: note.timePeriod,
    generated_at: note.generatedAt,
    title: note.title,
    content: note.content,
    changes: note.changes,
    contributors: note.contributors,
    video_url: note.videoUrl ?? null,
    video_data: note.videoData ?? null,
  } satisfies Record<string, unknown>;
}

async function interceptApiRoutes(page: Parameters<typeof test>[0]['page']) {
  let createdPatchNote: PatchNoteFixture | null = null;

  await page.route('**/api/patch-notes/new-release/send', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sentTo: 3 }),
    });
  });

  await page.route('**/api/patch-notes/new-release', async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      if (!createdPatchNote) {
        await route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(toApiPatchNote(createdPatchNote)),
      });
      return;
    }

    if (request.method() === 'PUT') {
      if (!createdPatchNote) {
        await route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) });
        return;
      }

      const payload = JSON.parse(request.postData() ?? '{}');
      createdPatchNote = {
        ...createdPatchNote,
        title: payload.title ?? createdPatchNote.title,
        content: payload.content ?? createdPatchNote.content,
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(toApiPatchNote(createdPatchNote)),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/patch-notes/patch-1', async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(toApiPatchNote(existingPatchNotes[0]!)),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/patch-notes', async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      const dataset = createdPatchNote
        ? [toApiPatchNote(createdPatchNote), ...existingPatchNotes.map(toApiPatchNote)]
        : existingPatchNotes.map(toApiPatchNote);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(dataset),
      });
      return;
    }

    if (request.method() === 'POST') {
      const payload = JSON.parse(request.postData() ?? '{}');
      createdPatchNote = {
        id: 'new-release',
        repoName: payload.repo_name,
        repoUrl: payload.repo_url,
        timePeriod: payload.time_period,
        generatedAt: payload.generated_at ?? new Date().toISOString(),
        title: payload.title,
        content: payload.content,
        changes: payload.changes,
        contributors: payload.contributors,
        videoUrl: payload.video_url ?? null,
        videoData: payload.video_data ?? undefined,
      };

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(toApiPatchNote(createdPatchNote)),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/github/branches**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { name: 'main', protected: true },
        { name: 'develop', protected: false },
      ]),
    });
  });

  await page.route('**/api/github/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        additions: 320,
        deletions: 120,
        commits: 6,
        contributors: ['eve', 'mallory', 'trent'],
      }),
    });
  });

  await page.route('**/api/github/summarize', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summaries: [
          {
            message: 'feat: add onboarding flow',
            aiSummary: 'Introduced onboarding wizard with analytics instrumentation.',
            additions: 180,
            deletions: 20,
          },
        ],
        overallSummary: 'Rolled out onboarding improvements with analytics hooks.',
      }),
    });
  });

  await page.route('**/api/videos/render', async (route) => {
    const request = route.request();
    const payload = JSON.parse(request.postData() ?? '{}');

    if (createdPatchNote) {
      createdPatchNote = {
        ...createdPatchNote,
        videoUrl: 'https://videos.example.com/new-release.mp4',
        videoData: payload.videoData ?? createdPatchNote.videoData,
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ videoUrl: 'https://videos.example.com/new-release.mp4' }),
    });
  });

  await page.route('**/api/videos/status/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hasVideo: Boolean(createdPatchNote?.videoUrl), videoUrl: createdPatchNote?.videoUrl ?? null }),
    });
  });

  await page.route('**/api/subscribers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'sub-1',
          email: 'dev@example.com',
          active: true,
          created_at: '2024-01-02T12:00:00.000Z',
          updated_at: '2024-05-02T12:00:00.000Z',
        },
        {
          id: 'sub-2',
          email: 'design@example.com',
          active: true,
          created_at: '2024-02-14T12:00:00.000Z',
          updated_at: '2024-05-20T12:00:00.000Z',
        },
        {
          id: 'sub-3',
          email: 'ops@example.com',
          active: false,
          created_at: '2024-03-03T12:00:00.000Z',
          updated_at: '2024-05-25T12:00:00.000Z',
        },
      ]),
    });
  });
}

function getStatsLocator(page: Parameters<typeof test>[0]['page'], testId: string) {
  return page.getByTestId(testId);
}

test.describe('Repatch end-to-end experience', () => {
  test('covers primary user flows from dashboard to subscribers', async ({ page }) => {
    await interceptApiRoutes(page);

    await test.step('load home dashboard with patch note data', async () => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Repatch' })).toBeVisible();
      await expect(getStatsLocator(page, 'stats-total-posts')).toHaveText('2');
      await expect(getStatsLocator(page, 'stats-repositories')).toHaveText('1');
      await expect(getStatsLocator(page, 'stats-this-month')).toHaveText('1');
      await expect(page.getByTestId('patch-card-patch-1')).toBeVisible();
      await expect(page.getByTestId('patch-card-patch-2')).toBeVisible();
    });

    await test.step('open existing patch note and verify detail view', async () => {
      await page.getByTestId('patch-card-patch-1').click();
      await expect(page).toHaveURL(/\/blog\/patch-1$/);
      await expect(page.getByRole('button', { name: 'Back to Home' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Weekly Update - Core Enhancements' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'openai/repatch' })).toHaveAttribute('href', 'https://github.com/openai/repatch');
      await page.getByRole('button', { name: 'Edit' }).click();
      await expect(page.getByRole('textbox', { name: 'Enter title...' })).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: 'Back to Home' }).click();
      await expect(page).toHaveURL('/');
    });

    await test.step('create a new patch note through the dialog', async () => {
      await page.getByRole('button', { name: 'Create New Post' }).click();
      await expect(page.getByRole('dialog', { name: 'Create Patch Note' })).toBeVisible();
      const repoInput = page.getByLabel('Repository URL');
      await repoInput.fill('https://github.com/openai/repatch');
      await expect(page.getByText('2 branches found. Select which branch to analyze')).toBeVisible();
      await page.getByRole('button', { name: /main/ }).click();
      await page.getByRole('option', { name: 'develop' }).click();
      await page.getByRole('button', { name: 'Last Week' }).click();
      await page.getByRole('option', { name: 'Last 24 Hours' }).click();
      const createButton = page.getByRole('button', { name: 'Create Patch Note' });
      await Promise.all([
        page.waitForURL(/\/blog\/new-release$/),
        createButton.click(),
      ]);
      await expect(page.getByRole('heading', { name: /Daily Update/ })).toBeVisible();
    });

    await test.step('edit the newly created patch note', async () => {
      await page.evaluate(() => {
        window.location.reload = () => {};
      });

      await page.getByRole('button', { name: 'Edit' }).click();
      const titleInput = page.getByRole('textbox', { name: 'Enter title...' });
      const contentInput = page.locator('textarea').last();
      await titleInput.fill('Daily Update - Repatch AI launch');
      await contentInput.fill('# Launch notes\n\n- Released AI summaries\n- Added onboarding checks');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByRole('heading', { name: 'Daily Update - Repatch AI launch' })).toBeVisible();
      await expect(page.getByText('Released AI summaries')).toBeVisible();
    });

    await test.step('generate video asset for the patch note', async () => {
      const alertPromise = page.waitForEvent('dialog');
      await page.getByRole('button', { name: '🎬 Generate Video' }).click();
      const alertDialog = await alertPromise;
      await expect(alertDialog.message()).toContain('Video generated successfully');
      await alertDialog.accept();
      await expect(page.getByText('✓ Custom Video')).toBeVisible();
    });

    await test.step('send the patch note email to subscribers', async () => {
      const confirmDialog = page.waitForEvent('dialog');
      await page.getByRole('button', { name: 'Send Email' }).click();
      const confirm = await confirmDialog;
      await expect(confirm.type()).toBe('confirm');
      await expect(confirm.message()).toContain('Send this patch note');
      const alertPromise = page.waitForEvent('dialog');
      await confirm.accept();
      const alertDialog = await alertPromise;
      await expect(alertDialog.message()).toContain('Patch note successfully sent to 3 subscriber');
      await alertDialog.accept();
    });

    await test.step('navigate to subscribers management view', async () => {
      await page.getByRole('button', { name: 'Back to Home' }).click();
      await expect(page).toHaveURL('/');
      await page.goto('/subscribers');
      await expect(page.getByRole('heading', { name: 'Subscribers' })).toBeVisible();
      await expect(page.getByText('Total Subscribers')).toBeVisible();
      await expect(page.getByText('dev@example.com')).toBeVisible();
      await expect(page.getByText('Active')).toBeVisible();
      await expect(page.getByText('Unsubscribed')).toBeVisible();
    });
  });
});
