# Playwright End-to-End Testing

## Why Playwright?
Playwright ships with a batteries-included test runner, automatic tracing, and rich network interception which makes it ideal for the hybrid UI/API coverage this project needs. Its parallel execution, Web-first assertions, and headless support keep CI times fast while still collecting artifacts when a regression appears. The framework also supports the same modern browsers we target in production, and provides first-class API testing primitives so we can reuse fixtures across UI and contract tests. See the official documentation for more background on capabilities and architecture: <https://playwright.dev/docs/intro>.

Cypress was evaluated (<https://docs.cypress.io/>) but would have required additional packages for API mocking, parallelization, and trace capture. Playwright’s single dependency and built-in CLI simplified onboarding and aligned better with the requirement to run offline when third-party integrations are unavailable.

## Project Structure

```
playwright.config.ts            # Global configuration, webServer + env toggles
/tests/playwright/e2e           # Full-stack browser journeys
/tests/playwright/api           # Offline API contract suites
app/api/test-utils/reset        # Test-only endpoint to reset in-memory fixtures
```

Smoke scenarios (patch note creation, GitHub integration config, subscriber email flow) live in `tests/playwright/e2e`. Contract tests for mocked GitHub and Resend endpoints live in `tests/playwright/api` to ensure the backend remains stable even when we are offline.

## Installation & Browser Setup

1. Install dependencies (Bun or npm both work):
   ```bash
   bun install
   bunx playwright install --with-deps
   ```
   The second command downloads browsers and codecs. Without it the Playwright runner cannot launch Chromium in CI.
2. Start Supabase/Next.js mocks locally by running the Playwright tests (the runner bootstraps everything):
   ```bash
   bun run test:e2e
   ```
3. To run a single file or match, use Playwright’s filtering flags:
   ```bash
   bunx playwright test tests/playwright/e2e/patch-note-smoke.spec.ts
   bunx playwright test --grep "GitHub integration"
   ```

> **Note:** The repository uses Bun, but `npx playwright` works equally well if you prefer npm.

## Environment Modes & Offline Fixtures

The test server automatically injects environment variables through `playwright.config.ts`:

| Variable | Default (CI/local) | Effect |
| --- | --- | --- |
| `USE_SUPABASE_MOCK=1` | Enabled | Uses the in-memory Supabase client defined in `lib/supabase/mockClient.ts`. |
| `RESEND_API_MODE=mock` | Enabled | Routes Resend calls to `lib/resend/mock.ts`, removing the external dependency. |
| `GITHUB_API_MODE=mock` | Enabled | Serves deterministic branches/commits from `lib/github-fixtures.ts`. |
| `DISABLE_VIDEO_RENDER=1` | Enabled | Skips Remotion background renders so tests stay fast. |
| `ALLOW_TEST_ENDPOINTS=1` | Enabled | Exposes `/api/test-utils/reset` for seeding/resetting fixtures between tests. |

To exercise real third-party integrations, unset the variables before running the suite (for example `GITHUB_API_MODE=` to hit live GitHub). When toggling back to live mode ensure you provide valid credentials via `.env.local`.

The reset endpoint accepts seed data so each test can isolate state:

```ts
await request.post("/api/test-utils/reset", {
  data: {
    supabase: { patch_notes: [], github_configs: [] },
    resend: { contacts: [{ email: "demo@example.com" }] },
  },
});
```

## Diagnostics & Artifacts

Playwright is configured to retain traces, screenshots, and videos on failure. Local runs write them to `playwright-report/` and `test-results/`. The CI workflow uploads the entire folder so you can download artifacts directly from GitHub when a regression appears.

To inspect a failure locally, run:
```bash
bunx playwright show-report
```
which opens the HTML report with embedded traces.

## CI Integration & Merge Gates

The workflow defined in `.github/workflows/playwright.yml` installs browsers, seeds the mock environment, and runs `bun run test:e2e`. Enable branch protection in GitHub to require the “Playwright” check before merging feature branches. This ensures end-to-end coverage stays healthy and prevents regressions from landing unnoticed.

## Contributing Tips

* Prefer reusing the mock helpers (`resetMockSupabase`, `resetMockResend`) to seed state rather than hitting production services.
* Keep fixtures in `lib/github-fixtures.ts` focused on realistic, high-signal commits so generated content remains meaningful.
* When adding new third-party integrations (Typefully, Customer.io, etc.), provide a similar mock factory and extend the test reset endpoint so contract tests can continue running offline.
* For long-running journeys, favor Playwright’s `test.step` helper to add semantic logging—these show up in HTML traces automatically.
