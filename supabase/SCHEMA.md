# Supabase Schema Reset Reference

This document inventories the data we actually use plus the exact steps required to rebuild migrations, regenerate types, and configure dual environments. Follow it from top to bottom whenever you need to re-bootstrap the database layer.

---

## Step-by-step implementation checklist

1. **Snapshot current state**
   - Ensure `bun install` has run and your `.env.local` contains Supabase service + anon keys.
   - Export any production data you care about (`supabase db dump --data-only`) because the migration reset will drop everything.

2. **Trim repository to the supported tables**
   - Delete all SQL files inside `supabase/migrations/`.
   - Create a new file named `supabase/migrations/00000000000000_initial_schema.sql` and paste the schema defined in the “Tables to keep” section below (patch notes + AI templates, enums, triggers, policies, indexes).

3. **Apply schema to a clean database**
   - Run `supabase db reset` locally (creates fresh shadow DB, runs the new initial migration).
   - Verify via `supabase db remote commit` if you maintain branch-based migrations, otherwise skip.
   - Optional: seed with `bun run db:seed` or `bun run scripts/add-sample-data.ts`.

4. **Regenerate TypeScript bindings**
   - Execute `supabase gen types typescript --project-ref <dev-ref> --schema public > lib/supabase/database.types.ts`.
   - Update domain models (`types/patch-note.ts`, `types/ai-template.ts`) and helper mappers (`lib/templates.ts`, Supabase service layers) to match the simplified columns. Remove references to dropped fields (`email_subscribers`, `github_configs`, etc.).
   - Run `bun run lint` to ensure the codebase compiles against the new types.

5. **Configure dual Supabase environments**
   - Create two Supabase projects (dev/prod). Save their URLs/keys in:
     - `.env.local` → dev project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
     - `.env.production` → prod project (same variables but prod values).
   - Add `supabase/config.toml` profiles or document CLI usage: `supabase link --project-ref <dev>` and `supabase link --project-ref <prod> --env prod`.
   - Workflow: develop migrations locally → `supabase db push` (dev) → validate → `supabase db deploy --env prod`.

6. **Document + automate**
   - Update `README.md` with reset instructions (copy this checklist, include CLI commands).
   - Ensure CI (or a manual script) runs `bun run lint`, `bunx jest --runInBand`, and `supabase db diff --linked` before deploys.
   - Wire seed scripts to respect the new env variables so developers can quickly populate dev DBs.

---

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
| `owner_id` | `uuid` FK → `auth.users.id` | Identifies which authenticated user owns the patch note; used for RLS and filtering dashboards. |
| `processing_status` | `processing_status_type` enum (`pending`, `fetching_stats`, `analyzing_commits`, `generating_content`, `generating_video`, `completed`, `failed`) | Drives dashboards, banners, and polling logic. |
| `processing_stage` | `text` | Human-readable status message shown in UI banners. |
| `processing_error` | `text` | Displayed any time processing fails or video rendering errors. |
| `processing_progress` | `integer` 0-100 | Optional progress meter surfaced in `app/blog/[id]/page.tsx`. |
| `created_at` | `timestamptz` | Auditing + default ordering fallback. |
| `updated_at` | `timestamptz` | Maintained via trigger for Supabase cache invalidation. |

**Indexes / constraints**

- B-tree indexes on `generated_at`, `repo_name`, `time_period`, `processing_status`.
- Partial index on `video_render_id` for fast polling lookups.
- GIN indexes on `video_top_changes` or `filter_metadata` are optional; focus on essentials above for the reset.
- RLS policies enforce `owner_id = auth.uid()` for CRUD access, with service-role bypass for background jobs.

### `ai_templates`

| Column | Type | Purpose / Usage |
| --- | --- | --- |
| `id` (PK) | `uuid` | Primary identifier across `/settings/templates` and API routes. |
| `name` | `text` | Display + select menus. |
| `content` | `text` | Markdown instructions loaded when editing templates and passed into `github-summarize.service`. |
| `created_at` | `timestamptz` | Auditing / ordering by “recent”. |
| `updated_at` | `timestamptz` | Maintained via trigger for optimistic UI refreshes. |
| `owner_id` | `uuid` FK → `auth.users.id` | Scopes templates per user so MCP + UI only see their own entries. |

**Relations & constraints**

- `patch_notes.ai_template_id` → `ai_templates.id` `ON DELETE SET NULL`.
- RLS policies restrict CRUD to the owning user (via `owner_id = auth.uid()`) while allowing service-role automation.

### `api_tokens`

| Column | Type | Purpose / Usage |
| --- | --- | --- |
| `id` (PK) | `uuid` | Token identifier displayed in settings UI. |
| `user_id` | `uuid` FK → `auth.users.id` | Owner of the token; defaults to the authenticated session. |
| `name` | `text` | Friendly label (e.g., "MCP CLI", "Render Bot"). |
| `token_hash` | `text` | SHA-256 hash of the token secret; plaintext is never stored. |
| `token_prefix` | `text` | Short preview to help identify tokens in UI/logs. |
| `scopes` | `text[]` | Placeholder for future fine-grained permissions. |
| `expires_at` | `timestamptz` | Optional expiration. |
| `last_used_at` | `timestamptz` | Updated whenever the token authenticates a request. |
| `revoked_at` | `timestamptz` | Marks tokens that were disabled by the owner. |
| `created_at` | `timestamptz` | Audit field. |

**Policies**

- Owner-based RLS for all operations with service-role bypass for automation & validation.

---

## Tables to drop during the reset

- `email_subscribers`
- `email_integrations`
- `github_configs`
- `ai_templates_backup`

These tables are unused in the Next.js codebase (only referenced in the auto-generated Supabase types) and can be removed when constructing the fresh migration.

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
| `owner_id` | `uuid` FK → `auth.users.id` | Identifies which authenticated user owns the record. |
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
- RLS policies restrict CRUD to rows where `owner_id = auth.uid()` and allow service-role overrides for automation.

### `ai_templates`

| Column | Type | Purpose / Usage |
| --- | --- | --- |
| `id` (PK) | `uuid` | Primary identifier across `/settings/templates` and API routes. |
| `name` | `text` | Display + select menus. |
| `content` | `text` | Markdown instructions loaded when editing templates and passed into `github-summarize.service`. |
| `created_at` | `timestamptz` | Auditing / ordering by “recent”. |
| `updated_at` | `timestamptz` | Maintained via trigger for optimistic UI refreshes. |
| `owner_id` | `uuid` FK → `auth.users.id` | Template owner used by the dashboard + MCP permissions. |

**Relations & constraints**

- `patch_notes.ai_template_id` → `ai_templates.id` `ON DELETE SET NULL`.
- RLS policies now scope templates per user (owner-based) with service-role bypass.

### `api_tokens`

| Column | Type | Purpose / Usage |
| --- | --- | --- |
| `id` (PK) | `uuid` | Token identifier displayed in the dashboard. |
| `user_id` | `uuid` FK → `auth.users.id` | Owner of the token; set automatically from the authenticated session. |
| `name` | `text` | Friendly label so users can differentiate workstation, MCP agent, etc. |
| `token_hash` | `text` | SHA-256 hash of the token secret (plaintext is never stored). |
| `token_prefix` | `text` | First 8 characters shown to help identify tokens during support requests. |
| `scopes` | `text[]` | Reserved for future fine-grained permissions (defaults to empty array = full access). |
| `expires_at` | `timestamptz` | Optional expiry timestamp for short-lived tokens. |
| `last_used_at` | `timestamptz` | Updated whenever the token successfully authenticates an API/MCP call. |
| `revoked_at` | `timestamptz` | Soft-delete marker; prevents further usage without dropping history. |
| `created_at` | `timestamptz` | Audit field. |

**Policies**

- Owner-based RLS for SELECT/INSERT/UPDATE/DELETE (`user_id = auth.uid()`).
- Service-role bypass for background jobs and token validation logic.

## Tables to drop

- `email_subscribers`
- `email_integrations`
- `github_configs`
- `ai_templates_backup`

These tables are unused in the Next.js codebase (only referenced in generated Supabase types) and will be removed during the migration reset.

