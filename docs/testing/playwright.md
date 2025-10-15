# Playwright End-to-End & Contract Testing

This project standardises on [Playwright](https://playwright.dev/docs/intro) for browser automation and API contract tests. Playwright ships with a batteries-included runner, trace viewer, and first-class network mocking, which aligns well with our need to exercise flows while third-party services are offline. Compared with [Cypress](https://docs.cypress.io/), Playwright offers:

- Native support for multi-page and multi-browser scenarios without paid tiers.
- Rich trace artefacts (screenshots, DOM snapshots, videos) that unblock debugging in CI.
- The same API surface for browser automation and isolated API testing, allowing us to reuse fixtures and mocks.
- Deterministic execution in headless mode with an auto-waiting query engine that avoids flake-prone `setTimeout` workarounds.

## Getting started

1. **Install dependencies** (requires outbound access):
   ```bash
   bun install
   bun run test:e2e:install
   ```
2. **Start the local Supabase stack** (one-time terminal):
   ```bash
   supabase start -x studio,inbucket,pgadmin,imgproxy,logflare,vector
   supabase db reset
   ```
3. **Create a `.env.test` file** by copying the template:
   ```bash
   cp .env.test.example .env.test
   ```
   Update values if you are targeting a remote Supabase instance.
4. **Seed application data** (handled automatically by the Playwright global setup, but can be run manually):
   ```bash
   bun run db:seed
   ```
5. **Run the suites**:
   ```bash
   # Full smoke suite
   bun run test:e2e

   # Headed/debug session
   bun run test:e2e:headed -- --project=chromium --trace=on

   # API-only checks
   bunx playwright test tests/api
   ```

Playwright artefacts (HTML reports, videos, traces) are emitted into `playwright-report/` and `playwright-artifacts/`. Use `bun run test:e2e:report` or `bun run test:e2e:trace <trace.zip>` to inspect them locally.

## Integration modes & third-party mocks

The test harness introduces an `INTEGRATION_MODE` environment flag with two modes:

- `mock` (default for CI and Playwright): GitHub and Resend calls are backed by deterministic fixtures under `lib/mocks/`. Future Typefully and Customer.io clients should follow the same pattern so that contract tests can run offline.
- `live`: real third-party APIs are invoked. Use this sparingly when validating credentials.

Toggle modes by exporting the variable before launching Playwright:

```bash
INTEGRATION_MODE=live bun run test:e2e
```

For ad-hoc runs that should temporarily hit the real services, set `PLAYWRIGHT_LIVE=1` to override the default without touching `.env.test`.

## Useful scripts

- `bun run test:e2e` – run the full Playwright suite.
- `bun run test:e2e:headed` – open Chromium and keep the window visible.
- `bun run test:e2e:report` – open the latest HTML report.
- `bun run ci:test:e2e` – CI-friendly reporter (used by GitHub Actions).
- `bun run test:e2e:install` – download the required browsers on fresh machines.

## CI behaviour

The workflow `.github/workflows/playwright.yml` provisions Supabase with Docker, runs migrations, seeds data, installs Playwright browsers, executes the suite in headless Chromium, and uploads artefacts on failure. The job is required for both `push` and `pull_request`, preventing merges while regressions exist.

## Debugging tips

- Pass `--grep` or `--project` flags after the npm script to target a subset of tests.
- Add `test.slow()` or `test.setTimeout()` inside scenarios that need longer waits.
- When writing new offline mocks, export helpers from `lib/mocks/` and branch on `useIntegrationMocks()` so the same code paths can talk to real services in live mode.
