import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    coverageName: "e2e",
  },
  coverage: {
    enabled: true,
    provider: "v8",
    cleanOnRun: true,
    include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"],
    reports: [
      ["html", { outputFolder: "coverage/playwright" }],
      ["json", { outputFile: "coverage/playwright/coverage.json" }],
      "text-summary",
    ],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: "bun dev",
    url: "http://127.0.0.1:3000",
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
