import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: [["list"], ["html", { outputFolder: "test-results" }]],
  use: {},
  projects: [
    {
      name: "unit",
      use: {},
    },
  ],
});
