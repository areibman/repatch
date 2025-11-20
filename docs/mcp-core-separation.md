## MCP-Core Separation Plan

### 1. Core API functions to extract

| Domain | Current endpoints | Backing services/modules | Notes for separation |
| --- | --- | --- | --- |
| AI templates | `GET/POST /api/ai-templates`, `PUT/DELETE /api/ai-templates/[id]` | `app/api/ai-templates`, `lib/templates.ts`, Supabase (`ai_templates`) | CRUD is already pure DB access. Move to `/core/templates` REST resource so MCP can list/update prompt blueprints without frontend coupling. |
| GitHub metadata | `/api/github/{branches,tags,labels,releases}` | `lib/github/api/repository.ts` | Expose as `/core/repos/{owner}/{repo}/{resource}`. Responses are passthrough Octokit data, so they can be safely reused by MCP tools. |
| Repo stats | `/api/github/stats` (`GET` query builder + `POST` validator) | `lib/services/github-stats.service.ts` (`fetchGitHubStats`) | Treat as deterministic read endpoint; same payload will serve UI, MCP, automation. |
| Summaries | `/api/github/summarize` | `lib/services/github-summarize.service.ts` (AI + Supabase templates) | Become `/core/repos/{owner}/{repo}/summaries` with `filters`, `branch`, optional template id. |
| Patch note records | `/api/patch-notes` collection + `/api/patch-notes/[id]` item | Supabase `patch_notes` table | Keep as canonical storage API. Move route logic into `core` namespace and require explicit `processingStatus` updates. |
| Patch note processing | `/api/patch-notes/[id]/process` | `processPatchNote` orchestrates stats, AI, video top changes | Turn into `/core/patch-notes/{id}:process` job creation that immediately returns job handle referencing `/core/jobs/{jobId}`. |
| Video rendering | `/api/patch-notes/[id]/render-video`, `/regenerate-video`, `/video-status` | `lib/services/video-render.service.ts`, `lib/remotion-lambda-renderer.ts` | Consolidate as `/core/patch-notes/{id}/video` (POST=start/regenerate, GET=status). Polling is backed by Supabase row + Lambda status. |
| Video AI helpers | `/api/patch-notes/generate-video-top3` | `generateVideoTopChangesFromContent` in `lib/ai-summarizer.ts` | Convert to `/core/video-top-changes` so MCP tools can request video-ready headlines for any summary text. |
| Notifications | `/api/patch-notes/[id]/send`, `/typefully`, `/api/subscribers` | Resend + Typefully integrations (`lib/typefully.ts`) | Model as `/core/notifications/email` + `/core/social/typefully` plus `/core/subscribers`. Keeps channel automation shareable. |

All of these routes already defer to pure functions in `lib/services` or single-purpose integration files, so pulling them behind a dedicated `/core` API + MCP wrapper is mostly a routing/contract exercise.

### 2. Consolidation opportunities

- **Patch-note job orchestration**: merge `process`, `render-video`, `video-status`, and `regenerate-video` into a single `/patch-notes/{id}/workflow` resource that exposes `jobType` (content vs. video) and inherits state fields from `patch_notes.processing_*`. This avoids bespoke polling endpoints and gives MCP one invariant contract.
- **Video helper endpoints**: `generate-video-top3` should live alongside patch-note jobs; responses can be embedded inside the patch note record (`videoData.topChanges`). Consolidating ensures Stainless only emits one tool for “video brief generation”.
- **GitHub metadata fetchers**: unify six small endpoints under `/repos/{owner}/{repo}/metadata?type=branches|tags|labels|releases`. Stainless can expose a single tool with an enum argument rather than six redundant tools.
- **Subscriber management**: current CRUD operations rely on query parameters (`DELETE /api/subscribers?email=`). Switching to `/subscribers/{id}` + JSON bodies will produce cleaner OpenAPI schemas and Stainless tool definitions.
- **Notification channels**: email + Typefully share similar inputs (patch note id + channel metadata). Introduce `/patch-notes/{id}/deliveries` with `{channel: "email"|"typefully"}` to combine logic and reuse auditing.

### 3. Target OpenAPI surface (see `openapi/mcp-core.yaml`)

- **Resources**: `Template`, `RepoStats`, `PatchNote`, `PatchNoteJob`, `VideoRenderStatus`, `Subscriber`.
- **Paths**:
  - `/templates` + `/templates/{templateId}`
  - `/repos/{owner}/{repo}/stats` (GET) and `/summaries` (POST)
  - `/patch-notes` CRUD plus `/patch-notes/{id}:process`
  - `/patch-notes/{id}/video` (POST start/regenerate, GET status)
  - `/patch-notes/{id}/deliveries` (POST for email/Typefully)
  - `/video-top-changes` (POST content -> list of talking points)
  - `/subscribers` CRUD
  - `/jobs/{jobId}` for polling long-running work
- **Async contract**: every long task returns `202 Accepted` with `jobId`, `jobType`, `status`, `nextPollAfter`. Clients (web or MCP) hit `GET /jobs/{jobId}` until `status in {completed, failed}`.

The spec encodes our existing DTOs (e.g., `PatchNoteFilters`, `ProcessingStatus`, `VideoTopChange`) so Stainless can map them 1:1 into tool inputs and validation logic.

### 4. Stainless MCP integration plan

1. **CLI setup**
   - Install the Stainless CLI in this repo (`bunx stainless login`, `bunx stainless init`) using the existing API key in the environment.
   - Commit a `stainless.config.ts` that points to `openapi/mcp-core.yaml` and enables the TypeScript target with the `mcp_server` option (per Stainless docs: `targets.typescript.options.mcp_server.enable_all_resources = true`).
2. **MCP server package**
   - Stainless generates `packages/mcp-server` inside the SDK bundle. Tie its data sources to our OpenAPI spec so each tool hits `/app/api/core/*` routes (or Supabase/service functions during local dev).
   - Configure publishing toggles (`mcp_server.publish.npm`, optional `mcp_server.publish.docker`) so we can ship NPM + Docker images. These values live in the config committed here.
3. **Tool curation**
   - Use Stainless’ filter hooks to hide purely frontend routes and only expose consolidated resources above.
   - Enable docs/code tools selectively: disable `enable_docs_tool` for now, keep `enable_code_tool` off until we need it, and add `enable_jq_filter: false` to avoid accidental data leakage.
4. **Distribution**
   - After spec + config are stable, run `bunx stainless generate --config stainless.config.ts` to produce the MCP server package.
   - Publish via `npx -y <pkg>-mcp@latest` instructions from Stainless docs; optionally push Docker images by setting `mcp_server.publish.docker.image_name`.
5. **Client wiring**
   - Document sample `claude_desktop_config.json` / `cursor.json` entries (per Stainless guide) so team members can test the generated server locally.

### 5. Polling and Remotion Lambda considerations

- `lib/remotion-lambda-renderer.ts` already persists `video_render_id`, `video_bucket_name`, and `processing_status` (`generating_video`, `completed`, `failed`). We can expose these fields via `/patch-notes/{id}/video` responses so any client—UI, MCP, automation—can check one endpoint.
- Jobs:
  - **Content processing**: `processPatchNote` updates Supabase as it progresses. Wrap this in a job record that mirrors `processing_stage` and surfaces `etaSeconds` heuristics for MCP clients.
  - **Video rendering**: `startVideoRender` is fire-and-forget; we return job metadata and reuse `getVideoRenderStatus` for polling. Expose `nextPollAfter` to throttle clients and mention AWS rate limits.
- For automation, combine both statuses under `GET /jobs/{jobId}` by storing job metadata in Supabase (new `core_jobs` table or reuse patch note row). Polling clients no longer need separate knowledge of Lambda specifics—they just fetch the job resource.

### 6. Immediate implementation steps

1. Create `docs/mcp-core-separation.md` (this file) so engineering + product share the same map.
2. Check in `openapi/mcp-core.yaml` as the canonical contract feeding Stainless.
3. Add `stainless.config.ts` plus a `package.json` script stub (`"stainless:generate": "stainless generate --config stainless.config.ts"`) so engineers can regenerate the MCP server.
4. Introduce an `app/api/core/` namespace (next increment) that proxies to existing services and follows the OpenAPI schema, then gradually migrate the frontend to consume `/core`.

Once the new `/core` routes exist we can point Stainless’ generated MCP server directly at them, giving us a single surface for UI + MCP while retaining today’s services layer for business logic.
