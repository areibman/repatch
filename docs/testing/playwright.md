# Playwright End-to-End & Contract Testing

This project adopts [Playwright](https://playwright.dev/docs/intro) as the end-to-end (E2E) and API contract testing framework.

## Why Playwright

- **Single runner for UI + API tests.** Playwright ships with a test runner that can drive browsers _and_ issue HTTP requests, so UI journeys and API contracts live in one suite.
- **Offline-friendly mocks.** Built-in network interception and Node execution make it trivial to toggle between live integrations and mock fixtures, which we rely on for Typefully/Customer.io/GitHub parity testing.
- **Rich diagnostics.** Automatic screenshot, video, and trace collection is wired into CI to keep failures actionable.
- **Parity with Cypress ergonomics.** While Cypress was evaluated ([docs](https://docs.cypress.io/)), Playwright’s first-class API mocking and multi-browser coverage align better with our Next.js/Supabase stack and future migration of Cypress-style patterns.

## Quick Start

1. Install dependencies and Playwright browsers:
   ```bash
   bun install
   bunx playwright install --with-deps
   ```
2. Build the Next.js app once (Playwright reuses the production server):
   ```bash
   bun run build
   ```
3. Run the full suite in headless mode with offline fixtures:
   ```bash
   bun run test:e2e
   ```
4. Iterate locally with a headed browser:
   ```bash
   bun run test:e2e:headed
   ```

The default scripts start a production Next.js server (`next start`) in the background with mock Supabase and integration data. The suite exercises both UI flows under `tests/e2e` and API contracts under `tests/api`.

## Environment Modes & Mocks

| Variable | Description | Default in tests |
| --- | --- | --- |
| `REPATCH_INTEGRATION_MODE` | `live` hits real third-party APIs. `mock` serves fixtures for GitHub, Typefully, Customer.io, Resend, etc. | `mock` |
| `REPATCH_SUPABASE_MODE` | `live` uses Supabase; `mock` activates the in-memory Supabase emulator backed by `tests/fixtures/supabase-seed.json`. | `mock` |
| `REPATCH_SUPABASE_SEED` | Path to JSON seed for the mock Supabase client. | `tests/fixtures/supabase-seed.json` |
| `REPATCH_DISABLE_VIDEO_RENDER` | Skip expensive Remotion renders during tests. | `true` |
| `PLAYWRIGHT_HEADLESS` | Set to `false` to launch headed browsers. | `true` |

Switching to live integrations simply means unsetting the `REPATCH_*` overrides and providing the real credentials (e.g., `RESEND_API_KEY`, `GITHUB_TOKEN`).

### Resetting State Between Tests

A test-only endpoint (`POST /api/test-support/reset`) resets the in-memory Supabase store back to its fixture seed. This keeps UI and API tests deterministic without leaking state across test cases.

## Suite Layout

- `tests/e2e/patch-note-smoke.spec.ts` – full-stack patch note creation, editing, publishing, and email delivery.
- `tests/e2e/integration-config.spec.ts` – GitHub and email integration configuration flows.
- `tests/api/offline-contracts.spec.ts` – API-level contracts that ensure GitHub and Resend routes operate against mock dependencies when offline.
- `tests/fixtures` – reusable JSON fixtures for GitHub commits/branches, Resend contacts, and seeded Supabase tables.

## CI Integration & Merge Gating

The GitHub Actions workflow (`.github/workflows/playwright.yml`) builds the Next.js app, installs Playwright browsers, runs the headless suite with mocks, and uploads Playwright’s HTML report, trace files, and screenshots. Mark the `playwright` workflow as a required status check in branch protection to gate merges on green runs.

## Troubleshooting

- **Server fails to start**: Ensure `bun run build` was executed so `next start` has a production build.
- **Missing fixtures**: Playwright logs warn when a fixture file is missing. Populate `tests/fixtures` or adjust `REPATCH_FIXTURES_DIR`.
- **Live mode credentials**: When switching to live integrations, set `REPATCH_INTEGRATION_MODE=live` and supply `RESEND_API_KEY`, `GITHUB_TOKEN`, etc. The suite keeps trace diagnostics enabled in both modes.

## Contributing New Tests

1. Prefer colocating high-level journeys in `tests/e2e` and API contracts in `tests/api`.
2. Reuse or extend the JSON fixtures so offline mode stays deterministic.
3. Reset the mock Supabase database via `request.post('/api/test-support/reset')` in `beforeEach` hooks.
4. Update this document when introducing new toggles or workflows to keep onboarding friction low.
