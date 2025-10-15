import { test, expect } from '@playwright/test';

test.describe('Typefully integration', () => {
  test('integration page renders', async ({ page }) => {
    await page.goto('/integrations/typefully');
    await expect(page.getByRole('heading', { name: 'Typefully' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Connect' })).toBeVisible();
  });
});
