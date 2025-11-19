# Supabase Schema Reset Reference

This document inventories the only tables the application touches today and locks in the trimmed column set before rebuilding the migrations.

## Tables to keep

### `patch_notes`

| Column | Type | Purpose / Usage |
| --- | --- | --- |
| `id` (PK) | `uuid` | Primary identifier referenced across the UI (`app/page.tsx`, `app/blog/[id]/page.tsx`) and API routes. |
| `repo_name` | `text` | Displayed throughout the dashboard and email template; also passed to video rendering (`lib/remotion-lambda-renderer.ts`). |
| `repo_url` | `text` | Used in `app/blog/[id]/page.tsx` and the `/send` email route for deep links. |
| `repo_branch` | `text` (default `'main'`) | Selected in `CreatePostDialog` and shown in the blog detail template controls. |
| `time_period` | `time_period_type` enum (`1day` `1week` `1month` `custom` `release`) | Drives filters and badges in `app/page.tsx` and `formatFilterSummary`. |
| `generated_at` | `timestamptz` | Primary ordering field for `/api/patch-notes` and UI timelines. |
| `title` | `text` | Display + email subject. |
| `content` | `text` nullable | Holds markdown content; can be a placeholder (`'...'`) while processing. |
| `changes` | `jsonb` `{ added, modified, removed }` | Rendered in cards + email stats; default of zeroed counters. |
| `contributors` | `text[]` | Badges in list/detail views and the email template. |
| `filter_metadata` | `jsonb` | Stores serialized `PatchNoteFilters` for regeneration (`components/create-post-dialog.tsx`, `lib/services/patch-note-processor`). |
| `video_data` | `jsonb` | Raw Remotion input generated during processing (`lib/services/patch-note-processor`). |
| `video_top_changes` | `jsonb` | Manual overrides edited in `/blog/[id]` and consumed by Remotion Lambda. |
| `video_url` | `text` | Public link returned by Lambda and required before sending emails. |
| `video_render_id` | `text` | Tracks the Remotion Lambda job (`lib/remotion-lambda-renderer.ts`). |
| `video_bucket_name` | `text` | Pair with `video_render_id` for polling. |
| `ai_summaries` | `jsonb` | Array of commit summaries returned by `/api/github/summarize` for the UI + video fallback text. |
| `ai_overall_summary` | `text` | Displayed in detail view and stored for editing/regeneration. |
| `ai_detailed_contexts` | `jsonb` | “Internal changes” drawer + video scroll text. |
| `ai_template_id` | `uuid` FK → `ai_templates.id` | Links generated patch notes to the template selected in the UI. |
| `processing_status` | `processing_status_type` enum (`pending`, `fetching_stats`, `analyzing_commits`, `generating_content`, `generating_video`, `completed`, `failed`) | Drives dashboards, banners, and polling logic. |
| `processing_stage` | `text` | Human-readable status message shown in UI banners. |
| `processing_error` | `text` | Displayed any time processing fails or video rendering errors. |
| `processing_progress` | `integer` 0-100 | Optional progress meter surfaced in `app/blog/[id]/page.tsx`. |
| `created_at` | `timestamptz` | Auditing + default ordering fallback. |
| `updated_at` | `timestamptz` | Maintained via trigger for Supabase cache invalidation. |

**Indexes / constraints**

- B-tree indexes on `generated_at`, `repo_name`, `time_period`, `processing_status`.
- Partial index on `video_render_id` for fast polling lookups.
- GIN indexes on `changes`, `filter_metadata`, and `video_top_changes` are optional; we’ll focus on the essentials above.

### `ai_templates`

| Column | Type | Purpose / Usage |
| --- | --- | --- |
| `id` (PK) | `uuid` | Primary identifier across `/settings/templates` and API routes. |
| `name` | `text` | Display + select menus. |
| `content` | `text` | Markdown instructions loaded when editing templates and passed into `github-summarize.service`. |
| `created_at` | `timestamptz` | Auditing / ordering by “recent”. |
| `updated_at` | `timestamptz` | Maintained via trigger for optimistic UI refreshes. |

**Relations & constraints**

- `patch_notes.ai_template_id` → `ai_templates.id` `ON DELETE SET NULL`.
- RLS policies stay “allow all” for now (auth-free internal admin tooling).

## Tables to drop

- `email_subscribers`
- `email_integrations`
- `github_configs`
- `ai_templates_backup`

These tables are unused in the Next.js codebase (only referenced in generated Supabase types) and will be removed during the migration reset.

