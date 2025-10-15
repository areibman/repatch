# Playwright Coverage Overview

The end-to-end suite exercises the core product flows with mocked API responses so the UI can be verified without live Supabase, Resend, or GitHub credentials. Coverage is generated through Playwright's built-in V8 instrumentation (see `playwright.config.ts`). Running `bun run test:e2e:coverage` produces an HTML report at `coverage/playwright/index.html` alongside a machine-readable JSON summary.

## Automated Journeys

| Area | Scenario | Key Assertions |
| --- | --- | --- |
| Home dashboard | Loading the recent patch notes feed, computed stats, and CTA | Cards render with mocked data, repository counts are derived from the feed, and the "Create New Post" dialog can be launched. |
| Patch note creation | Full wizard from repo URL input through AI summarization and Supabase save | Branch lookup, stats summarization, and patch note POST requests are intercepted; the flow redirects to the newly created post and displays the generated summary content. |
| Patch detail management | Editing content, saving changes, sending the email broadcast, and requesting video generation | Inline editing updates the title/content, confirm and success dialogs appear for email delivery, and the video render request is issued with the correct payload. |
| Subscribers workspace | Audience snapshot and roster | Active/inactive counts are calculated and individual subscriber rows render with status chips. |

## Gaps & Next Steps

- **API error handling** – the suite validates the happy path for each flow; add negative coverage for Supabase/Resend failures as the product matures.
- **Video polling** – status polling is stubbed with a static response; extend tests to assert the UI refreshes when `hasVideo` flips to `true`.
- **Cross-browser nuances** – Chromium, Firefox, and WebKit run in parallel today. Monitor flake reports to decide whether to keep all three targets in CI.
- **Accessibility audits** – pair Playwright runs with `@axe-core/playwright` to keep regressions from slipping into key dialogs and detail pages.
