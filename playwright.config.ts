import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3000',
  },
});
