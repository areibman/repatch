import { defineConfig } from "@playwright/test";

process.env.NODE_ENV = process.env.NODE_ENV || "test";

export default defineConfig({
  testDir: "playwright/tests",
  timeout: 30_000,
  use: {
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  globalSetup: undefined,
  globalTeardown: undefined,
  expect: {
    timeout: 10_000,
  },
  workers: 1,
});
