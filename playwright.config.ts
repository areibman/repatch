import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 120 * 1000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: CI
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bunx next dev --hostname 0.0.0.0 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !CI,
    timeout: 120 * 1000,
    env: {
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
      USE_SUPABASE_MOCK: "1",
      GITHUB_API_MODE: "mock",
      RESEND_API_MODE: "mock",
      DISABLE_VIDEO_RENDER: "1",
      ALLOW_TEST_ENDPOINTS: "1",
    },
  },
});
