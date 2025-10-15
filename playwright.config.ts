import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 10_000,
  use: {
    headless: true,
  },
});
