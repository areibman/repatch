import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || "bunx next start -p 3000";

const webServerEnv = {
  ...process.env,
  REPATCH_INTEGRATION_MODE:
    process.env.REPATCH_INTEGRATION_MODE || "mock",
  REPATCH_SUPABASE_MODE: process.env.REPATCH_SUPABASE_MODE || "mock",
  REPATCH_SUPABASE_SEED:
    process.env.REPATCH_SUPABASE_SEED || "tests/fixtures/supabase-seed.json",
  REPATCH_DISABLE_VIDEO_RENDER:
    process.env.REPATCH_DISABLE_VIDEO_RENDER || "true",
};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
  },
  expect: {
    timeout: 10000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: webServerEnv,
  },
});
