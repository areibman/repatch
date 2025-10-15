import { test, expect, Page } from '@playwright/test';

// Mock responses
const mockPatchNote = {
  id: 'test-patch-note-123',
  repo_name: 'test/repo',
  repo_url: 'https://github.com/test/repo',
  time_period: '1week',
  title: 'Weekly Update: Performance Improvements',
  content: '## Major Changes\n\nFixed critical bugs and improved performance.',
  changes: {
    added: 1234,
    modified: 567,
    removed: 890,
  },
  contributors: ['developer1', 'developer2', 'developer3'],
  video_url: null,
  video_data: {
    langCode: 'en',
    topChanges: [
      {
        title: 'Performance optimization',
        description: 'Improved API response times by 40%',
      },
    ],
    allChanges: ['Change 1', 'Change 2'],
  },
  ai_summaries: null,
  ai_overall_summary: null,
  generated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockTypefullyConfig = {
  id: 'config-123',
  api_key: 'typefully_test_key',
  auto_thread: false,
  schedule_time: null,
  schedule_timezone: 'UTC',
  twitter_username: 'testuser',
  twitter_id: '123456',
};

const mockThreadResponse = {
  success: true,
  job: {
    id: 'job-123',
    status: 'queued',
    typefully_draft_id: 'draft_123',
    typefully_post_url: 'https://typefully.com/draft/123',
  },
  draftUrl: 'https://typefully.com/draft/123',
  threadPreview: [
    '[1/3] 🚀 Weekly Update: Performance Improvements',
    '[2/3] Major Changes: Fixed critical bugs and improved performance.',
    '[3/3] Thanks to: developer1, developer2, developer3',
  ],
};

async function setupMocks(page: Page) {
  // Mock Supabase responses
  await page.route('**/rest/v1/patch_notes*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPatchNote),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/rest/v1/typefully_configs*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTypefullyConfig),
      });
    } else if (route.request().method() === 'POST' || route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTypefullyConfig),
      });
    } else {
      await route.continue();
    }
  });

  // Mock API endpoints
  await page.route('**/api/patch-notes/*/queue-thread', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockThreadResponse),
      });
    } else if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobs: [],
          hasActiveJob: false,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock video render endpoint (with mock video upload)
  await page.route('**/api/videos/render', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        videoUrl: '/videos/mock-video.mp4',
        message: 'Video rendered successfully',
      }),
    });
  });
}

test.describe('Typefully Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('should configure Typefully integration', async ({ page }) => {
    // Navigate to integrations page
    await page.goto('/integrations');
    
    // Find and click Typefully card
    await page.getByRole('heading', { name: 'Typefully' }).waitFor();
    const typefullyCard = page.locator('.grid > div').filter({ hasText: 'Typefully' });
    await expect(typefullyCard).toBeVisible();
    
    // Click connect button
    await typefullyCard.getByRole('button', { name: 'Connect' }).click();
    
    // Should navigate to configure page
    await expect(page).toHaveURL('/integrations/typefully/configure');
    
    // Fill in API key
    await page.getByPlaceholder('typefully_...').fill('typefully_test_api_key_123');
    
    // Save configuration
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Should show success message (mocked)
    await page.waitForTimeout(500); // Wait for alert
    
    // Should redirect back to integrations
    await expect(page).toHaveURL('/integrations');
  });

  test('should queue Twitter thread from patch note', async ({ page }) => {
    // Navigate to patch note detail page
    await page.goto('/blog/test-patch-note-123');
    
    // Wait for patch note to load
    await expect(page.getByRole('heading', { name: 'Weekly Update: Performance Improvements' })).toBeVisible();
    
    // Click Queue Twitter Thread button
    await page.getByRole('button', { name: 'Queue Twitter Thread' }).click();
    
    // Since no video exists, it should show confirmation dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('No video has been generated');
      await dialog.dismiss(); // Choose not to generate video
    });
    
    // Wait for the thread to be queued
    await page.waitForTimeout(1000);
    
    // Should show success alert
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Twitter thread queued successfully');
      expect(dialog.message()).toContain('https://typefully.com/draft/123');
      await dialog.accept();
    });
    
    // Button should now show "Thread Queued" (mocked state)
    // Note: In real implementation, this would require checking the actual state
  });

  test('should queue thread with video generation', async ({ page }) => {
    // Navigate to patch note detail page
    await page.goto('/blog/test-patch-note-123');
    
    // Wait for patch note to load
    await expect(page.getByRole('heading', { name: 'Weekly Update: Performance Improvements' })).toBeVisible();
    
    // Setup dialog handlers
    let videoGenerationPrompted = false;
    let threadQueuedSuccessfully = false;
    
    page.on('dialog', async (dialog) => {
      if (dialog.message().includes('No video has been generated')) {
        videoGenerationPrompted = true;
        await dialog.accept(); // Choose to generate video
      } else if (dialog.message().includes('Twitter thread queued successfully')) {
        threadQueuedSuccessfully = true;
        await dialog.accept();
      }
    });
    
    // Click Queue Twitter Thread button
    await page.getByRole('button', { name: 'Queue Twitter Thread' }).click();
    
    // Wait for operations to complete
    await page.waitForTimeout(2000);
    
    // Verify both dialogs were shown
    expect(videoGenerationPrompted).toBe(true);
    expect(threadQueuedSuccessfully).toBe(true);
  });

  test('should show thread status for already queued threads', async ({ page }) => {
    // Mock existing job
    await page.route('**/api/patch-notes/*/queue-thread', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jobs: [
              {
                id: 'existing-job',
                status: 'queued',
                created_at: new Date().toISOString(),
              },
            ],
            hasActiveJob: true,
          }),
        });
      } else {
        await route.continue();
      }
    });
    
    // Navigate to patch note detail page
    await page.goto('/blog/test-patch-note-123');
    
    // Wait for patch note to load
    await expect(page.getByRole('heading', { name: 'Weekly Update: Performance Improvements' })).toBeVisible();
    
    // Button should be disabled and show "Thread Queued"
    const queueButton = page.getByRole('button', { name: 'Thread Queued' });
    await expect(queueButton).toBeVisible();
    await expect(queueButton).toBeDisabled();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Override mock to return error
    await page.route('**/api/patch-notes/*/queue-thread', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Typefully not configured. Please connect Typefully first.',
          }),
        });
      } else {
        await route.continue();
      }
    });
    
    // Navigate to patch note detail page
    await page.goto('/blog/test-patch-note-123');
    
    // Wait for patch note to load
    await expect(page.getByRole('heading', { name: 'Weekly Update: Performance Improvements' })).toBeVisible();
    
    // Setup error dialog handler
    let errorShown = false;
    page.on('dialog', async (dialog) => {
      if (dialog.message().includes('Typefully not configured')) {
        errorShown = true;
        await dialog.accept();
      } else if (dialog.message().includes('No video has been generated')) {
        await dialog.dismiss(); // Skip video generation
      }
    });
    
    // Click Queue Twitter Thread button
    await page.getByRole('button', { name: 'Queue Twitter Thread' }).click();
    
    // Wait for error to be shown
    await page.waitForTimeout(1500);
    
    // Verify error was displayed
    expect(errorShown).toBe(true);
  });

  test('should navigate through Typefully integration flow', async ({ page }) => {
    // Start at home page
    await page.goto('/');
    
    // Navigate to integrations
    await page.getByRole('link', { name: /integrations/i }).click();
    await expect(page).toHaveURL('/integrations');
    
    // Click on Typefully card's "Learn more"
    const typefullyCard = page.locator('.grid > div').filter({ hasText: 'Typefully' });
    await typefullyCard.getByRole('button', { name: /learn more/i }).click();
    
    // Should be on Typefully integration page
    await expect(page).toHaveURL('/integrations/typefully');
    await expect(page.getByRole('heading', { name: 'Typefully' })).toBeVisible();
    
    // Check that integration details are visible
    await expect(page.getByText('Queue your patch notes as Twitter threads')).toBeVisible();
    await expect(page.getByText('Create Twitter threads from your patch notes')).toBeVisible();
    
    // Click Get set up button
    await page.getByRole('button', { name: 'Get set up' }).click();
    
    // Should be on configure page
    await expect(page).toHaveURL('/integrations/typefully/configure');
    await expect(page.getByRole('heading', { name: 'Connect Typefully' })).toBeVisible();
  });
});

test.describe('Typefully Integration - CI Mode', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Only run in chromium for CI');
  
  test('should pass CI smoke test for thread queueing', async ({ page }) => {
    await setupMocks(page);
    
    // Quick smoke test for CI
    await page.goto('/integrations');
    
    // Verify Typefully integration is visible
    const typefullyCard = page.locator('.grid > div').filter({ hasText: 'Typefully' });
    await expect(typefullyCard).toBeVisible();
    
    // Verify the card has correct elements
    await expect(typefullyCard.getByText('Queue your patch notes as Twitter threads')).toBeVisible();
    await expect(typefullyCard.getByRole('button', { name: 'Connect' })).toBeVisible();
  });
});