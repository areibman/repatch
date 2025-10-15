# Typefully Integration

Repatch ships with a native Typefully integration so you can turn every patch note into a threaded post on X / Twitter. This document covers configuration, rendering requirements, and useful troubleshooting tips.

## Requirements

- A Typefully API key with access to the workspace you plan to post from
- The Typefully workspace ID (`wrk_...`) and profile ID (`pro_...`) exposed by the API
- An active Supabase instance with the latest migrations applied (adds `typefully_configs` and `typefully_jobs`)
- Remotion prerequisites (FFmpeg, system fonts) installed locally for video rendering

> **Note:** The Typefully API is rate limited (30 requests/minute and short video upload windows). Keep an eye on responses for `429` or `413` errors when running bulk jobs. Full details: [Typefully API docs](https://support.typefully.com/en/articles/8718287-typefully-api).

## Environment Variables

Add the following keys to `.env.local`:

```bash
TYPEFULLY_API_KEY=your_typefully_api_key
TYPEFULLY_WORKSPACE_ID=wrk_...
TYPEFULLY_PROFILE_ID=pro_...
# Optional overrides for testing
# TYPEFULLY_API_URL=https://api.typefully.com/v1
# TYPEFULLY_MOCK_MODE=true
# TYPEFULLY_SKIP_RENDER=true
```

- `TYPEFULLY_API_KEY` – authenticates every request.
- `TYPEFULLY_WORKSPACE_ID` / `TYPEFULLY_PROFILE_ID` – the default destination when you queue a thread. You can override them in the UI as needed.
- `TYPEFULLY_MOCK_MODE` – short-circuits external calls so Playwright and local dev can run without hitting the real API.
- `TYPEFULLY_SKIP_RENDER` – skips the heavy Remotion render and writes a placeholder video URL (useful for CI pipelines).

## Workflow Overview

1. Visit **Integrations → Typefully → Connect** and save your credentials.
2. Open any patch note. The new **Queue Twitter thread** button renders the latest video, uploads it to Typefully, and builds a threaded summary.
3. Status updates surface directly on the page. Successful runs record the Typefully thread ID, asset URL, and metadata in `typefully_jobs`.

Behind the scenes the API route:

- Re-runs the Remotion render (unless a fresh video already exists or you set `TYPEFULLY_SKIP_RENDER=true`).
- Uses the Typefully upload endpoint to store the MP4.
- Splits your summaries into 280-character posts and queues the thread.
- Persists job metadata to Supabase for auditing.

## Testing Tips

- Enable `TYPEFULLY_MOCK_MODE=true` and `TYPEFULLY_SKIP_RENDER=true` while running Playwright or unit tests to avoid long render times and external network calls.
- Mock jobs are still written to Supabase so you can verify UI states without leaving your testing environment.
- If you hit upload size limits, trim your Remotion render length or compress the video before retrying.

## Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| `400` with “configuration is missing” | No row in `typefully_configs` | Save credentials from the integration page |
| `500` during queueing | Missing video file or FFmpeg not installed | Re-run with Remotion prerequisites or enable mock flags |
| Thread stuck in `pending` | Typefully rate limits or auth failure | Regenerate an API key and ensure you stay under rate limits |

Need more help? Check the [Typefully API reference](https://support.typefully.com/en/articles/8718287-typefully-api) or inspect recent rows in `typefully_jobs` for detailed error messages.
