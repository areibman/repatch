import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envFile = process.env.PLAYWRIGHT_ENV ?? ".env.test";
const envPath = path.resolve(envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  const fallback = path.resolve(".env.local");
  if (fs.existsSync(fallback)) {
    dotenv.config({ path: fallback });
  }
}

if (!process.env.NEXT_PUBLIC_APP_URL) {
  process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000";
}

if (!process.env.INTEGRATION_MODE) {
  process.env.INTEGRATION_MODE = "mock";
}

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    headless: true,
  },
  globalSetup: require.resolve("./tests/setup/global-setup.ts"),
  outputDir: "./playwright-artifacts",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bunx next dev --hostname 0.0.0.0 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
