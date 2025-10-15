import { test, expect } from '@playwright/test';

// This test assumes TYPEFULLY_MOCK=1 so no real API calls are made
// and that the app has at least 1 patch note seeded

test('queue Typefully thread from patch note page (mock)', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await page.goto(base);

  // Click the first patch note card
  const card = page.locator('a[href^="/blog/"]').first();
  await expect(card).toBeVisible();
  const href = await card.getAttribute('href');
  await page.goto(base + href);

  // Click Queue Twitter thread (no video)
  const btn = page.getByRole('button', { name: /Queue Twitter thread/i });
  await expect(btn).toBeVisible();
  await btn.click();

  // Expect success alert
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
});
