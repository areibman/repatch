const config = {
  testDir: "./playwright/tests",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
  },
  webServer: {
    command: "bun run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      EMAIL_PROVIDER_MOCK: "true",
    },
  },
};

export default config;
