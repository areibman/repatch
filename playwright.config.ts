import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const HOST = process.env.HOST ?? "127.0.0.1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    command: `bun run dev -- --hostname 0.0.0.0 --port ${PORT}`,
    url: `http://${HOST}:${PORT}`,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "memory",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "memory",
      SUPABASE_USE_MEMORY: "true",
      NEXT_PUBLIC_APP_URL: `http://${HOST}:${PORT}`,
      TYPEFULLY_API_MOCK: "true",
      PATCH_NOTES_VIDEO_RENDER_MODE: "mock",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
