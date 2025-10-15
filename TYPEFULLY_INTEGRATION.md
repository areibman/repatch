# Typefully Integration

Repatch can queue patch note recaps as Twitter threads using [Typefully's API](https://support.typefully.com/en/articles/8718287-typefully-api). Each queued thread includes a Remotion-rendered teaser video attached to the first post.

## Credentials & Environment Variables

1. Visit **Settings → API** in your Typefully workspace and generate an API key.
2. Locate the **profile ID** for the Twitter/X account you want to post with. If your account belongs to a team, note the optional **workspace ID** as well.
3. Add the following variables to `.env.local`:

```bash
# Required to talk to Typefully's REST API
TYPEFULLY_API_BASE_URL=https://api.typefully.com/v1

# Optional test helpers (disable in production)
TYPEFULLY_API_MOCK=false
PATCH_NOTES_VIDEO_RENDER_MODE=mock
SUPABASE_USE_MEMORY=false
```

Set `TYPEFULLY_API_MOCK=true` and `PATCH_NOTES_VIDEO_RENDER_MODE=mock` when running Playwright or local smoke tests to skip real uploads and heavy Remotion renders. The Supabase memory toggle lets automated tests run without a live database.

## Connecting Typefully inside Repatch

1. Navigate to **Integrations → Typefully → Connect**.
2. Paste the API key, profile ID, and optional workspace ID.
3. Save the form to persist the credentials in Supabase.
4. Open any patch note page and click **Queue Twitter thread** to render the video, upload it to Typefully, and enqueue the thread.

The patch note page surfaces the latest job status (rendered, uploading, queued, or failed) so you can verify delivery.

## Rendering Requirements

- Remotion relies on FFmpeg for H.264 output. Ensure FFmpeg is available when `PATCH_NOTES_VIDEO_RENDER_MODE` is not set to `mock`.
- Video files are written to `public/videos/` and the relative path is stored back into the `patch_notes` table and `typefully_jobs` metadata.

## API Considerations

- Respect Typefully's published rate limits (currently 60 requests per minute per API key) and avoid queueing duplicate drafts.
- Attachments require an upload handshake (`POST /media` followed by a presigned upload). Repatch handles this internally via `uploadTypefullyVideo`.
- Threads are created via `POST /drafts` with `publishAction: "queue"`. The response includes the server-side state that Repatch stores in `typefully_jobs.response`.

If Typefully returns errors (invalid credentials, disabled workspace, etc.), the job record is marked as `failed` and surfaced on the patch note page.
