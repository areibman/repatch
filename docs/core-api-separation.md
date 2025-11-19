# Core API Separation & MCP Enablement

Goal: expose the product's core automation surface area (GitHub ingestion, patch-note generation, video rendering, and distribution) through an API that is decoupled from the Next.js app router so that future clients—including MCP servers generated via Stainless—can call it without going through frontend-specific contracts.

---

## 1. Core API Functionalities Ready for Separation

| Domain | Current Next.js Routes / Services | Responsibilities | External Dependencies | Separation Notes |
| --- | --- | --- | --- | --- |
| **AI Templates** | `GET/POST /api/ai-templates`, `PUT/DELETE /api/ai-templates/[id]`, `mapTemplateRow` | CRUD for summarization templates that drive Gemini prompts | Supabase `ai_templates` table | Pure CRUD; can move to `/v1/templates` with JWT/API-key auth and standard pagination |
| **Patch Note CRUD** | `GET/POST /api/patch-notes`, `GET/PUT/DELETE /api/patch-notes/[id]` | store patch-note metadata, content, contributors, filter metadata | Supabase `patch_notes` | Forms the canonical resource for downstream jobs; should be core API `/v1/patch-notes` |
| **Patch Note Processing Pipeline** | `POST /api/patch-notes/[id]/process` → `processPatchNote` service | orchestrates stats fetch, AI summarization, content persistence, transitions status fields | GitHub API, Gemini (via LiteLLM), Supabase | Surface as `/v1/patch-notes/{id}/process` returning a `jobId` so other clients (MCP) can poll |
| **Video Rendering** | `POST /api/patch-notes/[id]/render-video`, `POST /api/patch-notes/[id]/regenerate-video`, `GET /api/patch-notes/[id]/video-status`, `lib/remotion-lambda-renderer` | triggers AWS Lambda render jobs, stores render IDs, polls for completion | AWS Lambda, S3, Remotion assets, Supabase | Collapse to a single action endpoint and a reusable `/v1/jobs/{id}` status resource to enable polling / notifications |
| **Video Top-3 Extraction** | `POST /api/patch-notes/generate-video-top3` | runs Gemini prompt to extract top changes from markdown | Gemini | Stateless compute; fits under `/v1/video-top-changes` |
| **GitHub Metadata & Stats** | `GET /api/github/{branches,tags,labels,releases}`, `GET/POST /api/github/stats`, `POST /api/github/summarize` | fetch repo metadata and aggregated commit analytics | GitHub REST API, Octokit, caching | The four metadata endpoints share identical validation; combine into `/v1/github/metadata` with `type` param. Stats + summaries become canonical `/v1/github/stats` & `/v1/github/summaries` |
| **Distribution Channels** | `POST /api/patch-notes/[id]/send`, `POST /api/patch-notes/[id]/typefully` | Send newsletters via Resend, publish social drafts through Typefully | Resend API, Supabase Storage (signed URLs), Typefully API | Represent as `/v1/patch-notes/{id}/deliveries` + `/v1/patch-notes/{id}/social-drafts` so any client (CLI, MCP) can trigger distribution |
| **Subscribers** | `GET/POST/PUT/DELETE /api/subscribers` | Manage Resend contacts | Resend | Move into `/v1/subscribers` with basic CRUD + search |

---

## 2. Opportunities To Combine / Simplify Endpoints

- **GitHub Metadata**: replace four near-identical endpoints with `GET /v1/github/metadata?type=branches|tags|labels|releases&owner=&repo=`. This keeps caching logic centralized and makes Stainless tagging much easier.
- **Patch Note Actions**: unify `render-video`, `regenerate-video`, `video-status`, and `process` into `/v1/patch-notes/{id}/actions` (or dedicated subpaths) that accept an `action` enum and respond with a `Job` envelope.
- **Background Jobs**: create `/v1/jobs/{jobId}` (and optional `/v1/jobs?resourceType=video_render`) so polling semantics are identical for AI processing, video renders, or subscriber exports.
- **Distribution**: replace bespoke email + Typefully endpoints with `/deliveries` and `/social-drafts` collections that capture payloads, success metadata, and auditing data.
- **Video AI Helpers**: generalize `/generate-video-top3` into `/video-top-changes` that accepts markdown + repo slug and returns normalized top-change payloads (reusable by CLI/MCP clients).

---

## 3. OpenAPI Spec (Initial Target Surface)

- File: `openapi/core-api.yaml`
- Versioned base path: `/v1`
- Security: HTTP bearer (first-class tokens independent of Supabase session cookies)
- Resources captured:
  - `PatchNote`, `PatchNoteFilters`, `PatchNoteRequest`
  - `Job` abstraction (`type`, `status`, `progress`, `result`, `error`)
  - `VideoTopChangesRequest`
  - `AiTemplate`, `Subscriber`, `GitHubStatsRequest`, `GitHubSummaryRequest`
  - Distribution-specific payloads (`DeliveryRequest`, `SocialDraftRequest`)
- Paths include: CRUD for templates, patch notes, subscribers; action endpoints (`/patch-notes/{id}/process`, `/patch-notes/{id}/video-render`, `/patch-notes/{id}/deliveries`, `/patch-notes/{id}/social-drafts`); `/jobs/{id}`; `/github/metadata`, `/github/stats`, `/github/summaries`; `/video-top-changes`.
- Schemas keep parity with current Supabase row shapes so that we can reuse the same DB layer behind either Next.js or a standalone core API service.

---

## 4. Stainless + MCP Wrapper Plan

1. **Authoritative Spec**: iterate on `openapi/core-api.yaml` (source of truth).
2. **Stainless CLI bootstrap**:
   ```bash
   STAINLESS_API_KEY=... npx stainless login
   npx stainless push openapi/core-api.yaml
   ```
   This seeds Stainless Studio with the new surface.
3. **Configure MCP generation** inside `stainless.config.ts` (to be added after spec review):
   ```ts
   export default defineConfig({
     targets: {
       typescript: {
         options: {
           mcp_server: {
             enable_all_resources: false,      // start with curated set
             publish: {
               docker: "repatch/core-api-mcp"
             }
           }
         }
       }
     }
   });
   ```
4. **Filter exposed tools** using Stainless options (`resources.<name>.methods.<op>.mcp`) so that MCP clients only see business-safe actions (e.g., read-only GitHub stats vs. write operations).
5. **Distribution**:
   - Publish NPM package `@repatch/core-api-mcp` via Stainless (mirrors SDK versions).
   - Optional Docker image for hosted MCP.
6. **Client wiring**:
   - Claude Desktop / Cursor config example:
     ```json
     {
       "mcpServers": {
         "repatch_core_api": {
           "command": "npx",
           "args": ["-y", "@repatch/core-api-mcp", "--operation=read"],
           "env": { "REPATCH_API_KEY": "…" }
         }
       }
     }
     ```
7. **Runtime Filtering**: document how to narrow tools (`--tool`, `--resource`, `--operation`) so LLMs are not overwhelmed.

---

## 5. Polling & Long-Running Actions

- **Jobs Table / API**: represent every asynchronous workflow (patch-note processing, video renders, mass email deliveries) as a `Job` record with timestamps, progress (0–100), and resource references.
- **Polling Contract**: `/v1/patch-notes/{id}/process` and `/patch-notes/{id}/video-render` both return `{ jobId, statusUrl }`. Clients call `GET /v1/jobs/{jobId}` until status is `completed` or `failed`.
- **Push-friendly Hooks**: design the job schema so we can later add webhooks or SSE without changing clients.
- **Timeout + retries**: encode recommended retry intervals (e.g., video status every 10s, processing every 30s) in documentation for MCP actions so agents avoid hammering AWS Lambda.
- **Remotion Lambda specifics**: job metadata should include `renderId`, `bucketName`, and `patchNoteId` so the backend can resume polling even if the client disconnects.

---

## 6. Initial Implementation Done & Next Steps

✅ Added this architectural brief plus `openapi/core-api.yaml` as the authoritative spec scaffold.  
➡️ Next up:
1. Review/extend the OpenAPI document with domain experts (Supabase column names, optional fields, error envelopes).
2. Extract the existing route logic into `/core` (Edge runtime or standalone server) that implements the spec.
3. Introduce a `Job` persistence layer (table + service) before exposing the endpoints publicly.
4. Wire Stainless config + CLI automation, then generate the MCP server package.

These artifacts unblock Stainless ingestion and provide a concrete foundation for splitting the API away from the frontend.

