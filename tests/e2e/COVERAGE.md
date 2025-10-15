# E2E Scenario Coverage

The Playwright suite focuses on the highest-impact product flows. Each row below maps to an end-to-end expectation that is currently automated.

| Area | Scenarios covered | Notes |
| --- | --- | --- |
| Home dashboard | Rendering header, statistics widgets, and populated patch note grid | API traffic is intercepted to provide deterministic fixtures. |
| Patch note details | View an existing post, toggle edit mode, cancel without saving | Exercises `/blog/[id]` layout, markdown rendering, and navigation back to the dashboard. |
| Create patch note dialog | Repository URL validation, branch auto-selection, time-period switching, submission success path | Mocks GitHub stats/summaries plus Supabase persistence so the UI behaves without external services. |
| Patch note management | Editing title/content, video generation CTA, email blast workflow | Confirms optimistic UI updates, alert/confirm handling, and Remotion badge states. |
| Subscribers workspace | Audience metrics, list rendering, and subscriber status chips | Verifies the management dashboard using mocked Resend data. |

## Gaps to target next

- Error states for patch note fetches and subscriber retrieval (e.g., Supabase outage) are still manual.
- Delete flows for patch notes are not automated.
- Remotion player rendering is smoke-tested via visibility, but playback controls are not asserted.
- API polling for video availability is stubbed; a backend happy-path test would ensure the polling banner flips automatically.

## Generating instrumentation coverage

When Chromium coverage is enabled (`npm run test:e2e:coverage`), Playwright stores raw V8 data inside `.playwright-coverage/`. Convert it into a consumable summary with:

```bash
npx playwright coverage show --reporter=text
npx playwright coverage show --reporter=html --output=playwright-coverage/html
```

The HTML report mirrors Istanbul semantics and highlights untouched files. Commit coverage artifacts only when explicitly requested.
