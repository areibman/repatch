import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  use: {
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
});
