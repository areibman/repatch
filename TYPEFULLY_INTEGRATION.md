# Typefully Integration

This document describes the Typefully integration for queueing patch notes as threaded Twitter posts with optional video uploads.

## Overview

The Typefully integration allows you to automatically format your patch notes as Twitter threads and queue them in your Typefully account. You can optionally include rendered videos with your threads.

## Features

- ✅ Automatic thread formatting from patch note content
- ✅ Optional video rendering and upload
- ✅ Job tracking with status updates
- ✅ Thread management via Typefully dashboard
- ✅ Support for AI-generated summaries

## Setup

### 1. Get Your Typefully API Key

1. Log in to your Typefully account
2. Navigate to Settings → API
3. Create a new API key
4. Copy the key (starts with `tfapi_`)

### 2. Configure the Integration

1. Navigate to `/integrations/typefully` in your application
2. Click "Connect" or "Configure"
3. Paste your API key
4. Click "Save"

### 3. Environment Variables

While the integration works without additional environment variables, you may want to set:

```bash
# Optional: Base URL for video links in threads
NEXT_PUBLIC_APP_URL=https://your-app-domain.com

# Or if using Vercel
VERCEL_URL=your-app.vercel.app
```

## Usage

### Queueing a Twitter Thread

1. Navigate to a patch note detail page
2. Click the "Queue Twitter Thread" button
3. Choose whether to include a video (optional)
4. The thread will be created as a draft in Typefully
5. Review and publish from your Typefully dashboard

### Thread Format

The integration automatically formats your patch notes into Twitter-friendly threads:

- **First tweet**: Title, repository name, and thread intro
- **Subsequent tweets**: Content sections (respecting 280 character limit)
- **Final tweet** (if video included): Video link

## Database Schema

### `typefully_configs`

Stores Typefully API configuration:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `api_key` | TEXT | Typefully API key |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

### `typefully_jobs`

Tracks thread queueing jobs:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `patch_note_id` | UUID | Reference to patch note |
| `thread_id` | TEXT | Typefully draft ID |
| `status` | TEXT | Job status (pending/completed/failed) |
| `video_uploaded` | BOOLEAN | Whether video was uploaded |
| `error_message` | TEXT | Error message if failed |
| `queued_at` | TIMESTAMP | When job was queued |
| `completed_at` | TIMESTAMP | When job completed |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

## API Reference

### Configuration Endpoints

#### `GET /api/integrations/typefully/config`

Check if Typefully is configured.

**Response:**
```json
{
  "configured": true
}
```

#### `POST /api/integrations/typefully/config`

Save Typefully API key.

**Request:**
```json
{
  "apiKey": "tfapi_..."
}
```

**Response:**
```json
{
  "success": true
}
```

#### `DELETE /api/integrations/typefully/config`

Remove Typefully integration.

**Response:**
```json
{
  "success": true
}
```

### Queue Endpoint

#### `POST /api/integrations/typefully/queue`

Queue a Twitter thread for a patch note.

**Request:**
```json
{
  "patchNoteId": "uuid",
  "includeVideo": true
}
```

**Response:**
```json
{
  "success": true,
  "threadId": "draft_id",
  "jobId": "job_uuid",
  "message": "Twitter thread queued successfully"
}
```

## API Limitations

### Typefully API Limits

- **Rate limiting**: Typefully API has rate limits based on your plan
- **Media upload size**: Video files should be under 512MB
- **Draft storage**: Free plan may have draft limits

### Video Rendering

- **Render time**: Video rendering can take 2-5 minutes depending on content
- **Storage**: Rendered videos are stored in `public/videos/`
- **Cleanup**: Consider implementing cleanup for old videos

### Thread Formatting

- **Character limit**: Each tweet is limited to 280 characters
- **Thread length**: No hard limit, but very long threads may not perform well
- **Media**: Only one video per thread (Twitter limitation)

## Troubleshooting

### "Typefully is not configured"

Make sure you've saved your API key in the configuration page.

### "Failed to queue Twitter thread"

1. Check that your API key is valid
2. Verify you have network connectivity to Typefully API
3. Check the job status in the database for error details

### Video upload fails

1. Ensure video file is under size limit
2. Check that video rendered successfully first
3. Verify your Typefully plan supports media uploads

### Thread formatting issues

1. Very long paragraphs may be split awkwardly
2. Code blocks and complex markdown may not format perfectly
3. Consider editing the draft in Typefully before publishing

## Development

### Running Migrations

```bash
# Apply the Typefully migration
supabase db push
```

### Testing the Integration

```bash
# Run E2E tests
bunx playwright test
```

### Local Development

1. Set up Supabase locally or use a dev project
2. Configure your Typefully API key
3. Test with sample patch notes

## Security Notes

- API keys are stored encrypted in Supabase
- Never commit API keys to version control
- Use environment variables for sensitive configuration
- Enable RLS policies for production deployments

## Support

For issues with:
- **Typefully API**: https://support.typefully.com/
- **This integration**: Open a GitHub issue

## Future Enhancements

Potential improvements for this integration:

- [ ] Scheduled publishing support
- [ ] Multiple account support
- [ ] Thread templates
- [ ] Analytics integration
- [ ] Auto-publish on patch note creation
- [ ] Image/GIF support alongside videos
