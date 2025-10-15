import { test, expect, Page } from '@playwright/test';

// Mock Typefully API responses
const mockTypefullyAPI = async (page: Page) => {
  await page.route('**/api/integrations/typefully/config', async (route) => {
    const request = route.request();
    const method = request.method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: false }),
      });
    } else if (method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }
  });

  await page.route('**/api/integrations/typefully/queue', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        threadId: 'mock_thread_123',
        jobId: 'mock_job_456',
        message: 'Twitter thread queued successfully',
      }),
    });
  });
};

test.describe('Typefully Integration', () => {
  test.beforeEach(async ({ page }) => {
    await mockTypefullyAPI(page);
  });

  test('should display Typefully card on integrations page', async ({ page }) => {
    await page.goto('/integrations');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check if Typefully card is present
    const typefullyCard = page.locator('text=Typefully');
    await expect(typefullyCard).toBeVisible();

    // Check description
    await expect(
      page.locator('text=Queue patch notes as threaded Twitter posts')
    ).toBeVisible();

    // Check badge
    await expect(page.locator('text=Social')).toBeVisible();
  });

  test('should navigate to Typefully integration page', async ({ page }) => {
    await page.goto('/integrations');
    await page.waitForLoadState('networkidle');

    // Click on "Learn more" button
    const typefullyCard = page.locator('text=Typefully').locator('..');
    await typefullyCard.locator('text=Learn more').click();

    // Should navigate to Typefully page
    await expect(page).toHaveURL('/integrations/typefully');

    // Check page content
    await expect(
      page.locator('text=Queue your patch notes as threaded Twitter posts')
    ).toBeVisible();
  });

  test('should display configure page', async ({ page }) => {
    await page.goto('/integrations/typefully/configure');
    await page.waitForLoadState('networkidle');

    // Check page title
    await expect(page.locator('text=Connect Typefully')).toBeVisible();

    // Check API key input
    const apiKeyInput = page.locator('input[type="password"]');
    await expect(apiKeyInput).toBeVisible();
    await expect(apiKeyInput).toHaveAttribute('placeholder', 'tfapi_...');

    // Check buttons
    await expect(page.locator('text=Cancel')).toBeVisible();
    await expect(page.locator('button:has-text("Save")')).toBeVisible();
  });

  test('should save Typefully configuration', async ({ page }) => {
    await page.goto('/integrations/typefully/configure');
    await page.waitForLoadState('networkidle');

    // Fill in API key
    const apiKeyInput = page.locator('input[type="password"]');
    await apiKeyInput.fill('tfapi_test_key_12345');

    // Click save button
    page.on('dialog', (dialog) => dialog.accept());
    await page.locator('button:has-text("Save")').click();

    // Wait for success message
    await page.waitForTimeout(500);
  });

  test('should queue a Twitter thread (with mock video)', async ({ page }) => {
    // Mock the patch notes API
    await page.route('**/api/patch-notes/*', async (route) => {
      const url = route.request().url();
      if (url.includes('/send')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            sentTo: 5,
            emailId: 'mock_email_id',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'mock-patch-note-id',
            repo_name: 'test/repo',
            repo_url: 'https://github.com/test/repo',
            time_period: '1week',
            title: 'Test Patch Note',
            content: '# Changes\n\n- Feature 1\n- Feature 2',
            changes: { added: 100, modified: 50, removed: 20 },
            contributors: ['user1', 'user2'],
            video_url: '/videos/test.mp4',
            generated_at: new Date().toISOString(),
          }),
        });
      }
    });

    await page.route('**/api/videos/status/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hasVideo: true,
          videoUrl: '/videos/test.mp4',
        }),
      });
    });

    await page.goto('/blog/mock-patch-note-id');
    await page.waitForLoadState('networkidle');

    // Wait for the Queue Twitter Thread button to be visible
    const queueButton = page.locator('button:has-text("Queue Twitter Thread")');
    await expect(queueButton).toBeVisible({ timeout: 10000 });

    // Mock the confirm dialog to include video
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        await dialog.accept(); // Accept the video inclusion
      } else if (dialog.type() === 'alert') {
        const message = dialog.message();
        expect(message).toContain('Twitter thread queued successfully');
        await dialog.accept();
      }
    });

    // Click the queue button
    await queueButton.click();

    // Button should show loading state
    await expect(page.locator('text=Queueing...')).toBeVisible();

    // Wait for completion
    await page.waitForTimeout(1000);
  });

  test('should handle queueing errors gracefully', async ({ page }) => {
    // Override the mock to return an error
    await page.route('**/api/integrations/typefully/queue', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Failed to connect to Typefully API',
        }),
      });
    });

    // Mock the patch notes API
    await page.route('**/api/patch-notes/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-patch-note-id',
          repo_name: 'test/repo',
          repo_url: 'https://github.com/test/repo',
          time_period: '1week',
          title: 'Test Patch Note',
          content: '# Changes\n\n- Feature 1',
          changes: { added: 100, modified: 50, removed: 20 },
          contributors: ['user1'],
          video_url: null,
          generated_at: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/videos/status/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hasVideo: false,
        }),
      });
    });

    await page.goto('/blog/mock-patch-note-id');
    await page.waitForLoadState('networkidle');

    // Wait for the Queue Twitter Thread button
    const queueButton = page.locator('button:has-text("Queue Twitter Thread")');
    await expect(queueButton).toBeVisible({ timeout: 10000 });

    // Mock the dialogs
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        await dialog.dismiss(); // Don't include video
      } else if (dialog.type() === 'alert') {
        const message = dialog.message();
        expect(message).toContain('Failed to connect to Typefully API');
        await dialog.accept();
      }
    });

    await queueButton.click();

    // Wait for error handling
    await page.waitForTimeout(1000);
  });

  test('should delete Typefully configuration', async ({ page }) => {
    // Mock configured state
    await page.route('**/api/integrations/typefully/config', async (route) => {
      const method = route.request().method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ configured: true }),
        });
      } else if (method === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.goto('/integrations/typefully/configure');
    await page.waitForLoadState('networkidle');

    // Should see Remove Integration button
    const removeButton = page.locator('button:has-text("Remove Integration")');
    await expect(removeButton).toBeVisible();

    // Mock confirm and alert dialogs
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        await dialog.accept();
      } else if (dialog.type() === 'alert') {
        expect(dialog.message()).toContain('removed successfully');
        await dialog.accept();
      }
    });

    // Click remove
    await removeButton.click();

    // Wait for completion
    await page.waitForTimeout(500);
  });
});
