import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 30_000,
  fullyParallel: false,
  use: {
    trace: "on-first-retry",
  },
});
