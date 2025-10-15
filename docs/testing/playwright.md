# Playwright End-to-End & Contract Testing

## Why Playwright?
- **Built-in test runner & fixtures** – Unlike Cypress, Playwright ships with its own runner and fixtures, keeping the toolchain lightweight while enabling isolated browser contexts per test ([Playwright docs](https://playwright.dev/docs/intro)).
- **First-class API mocking** – Playwright's `route` interception and request fixtures work cleanly with Next.js API routes, allowing us to simulate third-party outages without external servers.
- **Rich debugging assets** – Native trace viewer, video recording, and failure screenshots are captured automatically and exported from CI for actionable failures.
- **Multi-browser coverage** – Chromium, Firefox, and WebKit engines are available through one API, easing expansion beyond the current Chromium smoke coverage.

Cypress remains a viable UI harness, but Playwright's all-in-one runner and offline-friendly API tooling map more directly to our Supabase/Next.js stack requirements, so we standardise on Playwright.

## Repository Layout
```
playwright/
  tests/               # Browser and API tests
playwright.config.ts   # Shared configuration & web server bootstrap
```
Mock fixtures and reusable seed data live under `lib/__fixtures__/` and `lib/testing/` so UI/API routes can swap to in-memory storage in test mode.

## Installation & Local Execution
1. Install dependencies (Bun or npm both supported):
   ```bash
   bun install
   bunx playwright install --with-deps
   ```
2. Set the minimum environment variables (dummy values are fine for mock mode):
   ```bash
   export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1/mock-supabase
   export NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon-key
   export RESEND_API_KEY=mock-resend-key
   export REPATCH_TEST_MODE=mock
   ```
3. Run the suite:
   ```bash
   bun run test:e2e
   ```
   Use `bun run test:e2e:headed` for interactive debugging.

The Playwright config launches `bunx next dev` automatically and seeds the mock store before each test via `/api/testing/reset`.

## Switching Between Mock & Live Integrations
- `REPATCH_TEST_MODE=mock` (default in CI) activates in-memory Supabase, GitHub, Resend, and video rendering fixtures. No external calls are made and tests are offline-safe.
- `REPATCH_TEST_MODE=live` forwards API routes to real services. Supply the genuine `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`, and `GITHUB_TOKEN` before running.
- Optional per-integration overrides:
  - `MOCK_GITHUB=0` (future) could force GitHub live calls while keeping email mocked.
  - `RESEND_API_KEY` absence in live mode will short-circuit email delivery with descriptive errors.

CI defaults to mock mode while allowing maintainers to set repository secrets for periodic live integration runs.

## Test Coverage Overview
- **`smoke.spec.ts`** – Exercises the core user journeys: dashboard render, patch note creation, GitHub/Resend configuration, email publishing, and subscriber dashboard visibility.
- **`api.contract.spec.ts`** – Validates offline API contracts for GitHub analytics, Supabase-backed patch notes, email sending, Resend subscriber CRUD, and video rendering fallbacks.

Both suites reset the mock datastore before each test, ensuring deterministic state without external seeding jobs.

## Failure Artefacts & CI Integration
Playwright captures:
- Trace files (`trace.zip`) for each failed test.
- Failure-only screenshots and MP4 videos.

GitHub Actions uploads these artefacts automatically (see `.github/workflows/playwright.yml`). Review them with `npx playwright show-trace <trace.zip>` for low-friction triage.

## Contributor Tips
- Keep reusable fixtures in `lib/testing/mockStore.ts` so UI and API layers share consistent mock data.
- Extend the Playwright config's `projects` array if you need Firefox/WebKit coverage.
- Scope new tests by tag: `bunx playwright test smoke` executes only the UI flow.
- When expanding integrations (Typefully, Customer.io), plug their mocks into the same `REPATCH_TEST_MODE` guard so they benefit from the offline contract suite.
