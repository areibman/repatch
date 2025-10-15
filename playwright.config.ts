import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun run dev",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${PORT}`,
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key",
      TYPEFULLY_API_KEY: process.env.TYPEFULLY_API_KEY ?? "mock-api-key",
      TYPEFULLY_WORKSPACE_ID:
        process.env.TYPEFULLY_WORKSPACE_ID ?? "wrk_mock_workspace",
      TYPEFULLY_PROFILE_ID: process.env.TYPEFULLY_PROFILE_ID ?? "pro_mock_profile",
      TYPEFULLY_MOCK_MODE: "true",
      TYPEFULLY_SKIP_RENDER: "true",
    },
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
