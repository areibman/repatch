# Core API & MCP Separation Brief

Updated: 2025-11-19

This document inventories the pieces of the current Next.js codebase that belong in a shared “core API” surface, identifies consolidation opportunities, describes the OpenAPI contract we want Stainless to manage, and lays out a plan for exposing that contract through Stainless’ MCP (Model Context Protocol) wrapper. It also captures how we intend to support long‑running, polling-heavy jobs such as Remotion Lambda renders.

---

## 1. Core API functionality that can move behind a shared service boundary

| Domain | Current entry points | Description |
| --- | --- | --- |
| Patch note lifecycle | `app/api/patch-notes` + `lib/services/patch-note-processor.service.ts` | CRUD around the `patch_notes` table (Supabase), AI summarization, boilerplate fallback, and persistence of filters, contributors, AI artifacts, and processing metadata. |
| Patch note actions | `app/api/patch-notes/[id]/{process,render-video,regenerate-video,video-status,send,typefully}` | Long-running workflows (process with AI + GitHub, trigger Remotion rendering, poll render progress, send email via Resend, draft Typefully threads). These should be lifted as “action” sub-resources on a patch note. |
| GitHub data access | `app/api/github/*` + `lib/services/github-*.service.ts` | Thin adapters over the modular Octokit client for branches/tags/releases/labels/statistics and summarization. This entire surface can run headless without the Next.js UI. |
| AI template management | `app/api/ai-templates` + `types/ai-template.ts` | CRUD for reusable prompt templates stored in Supabase (`ai_templates`). Integrations (summaries, processor) load templates via this API. |
| Subscriber management & delivery | `app/api/subscribers` + `app/api/patch-notes/[id]/send` | Self-serve CRUD for Resend audiences plus outbound delivery of generated content. |
| Video orchestration | `app/api/patch-notes/[id]/render-video`, `/regenerate-video`, `/video-status`, `lib/remotion-lambda-renderer.ts`, `lib/services/video-render.service.ts` | Triggers AWS Lambda renders, persists render IDs + buckets, polls progress, and updates Supabase once an asset is ready. A standalone API makes it reusable for other clients (CLI, MCP, etc.). |

Each of these slices already uses pure services under `lib/services/*`. Moving them behind a common REST/OpenAPI layer lets us expose the same capabilities through the web UI, Stainless’ SDKs, and MCP servers without double-maintaining HTTP adapters.

---

## 2. Consolidation & unified endpoints

1. **GitHub metadata multiplexer** – Collapse `/api/github/{branches,tags,releases,labels}` into a single `/github/metadata` endpoint that accepts `resource=branches|tags|releases|labels`. This reduces redundant validation and gives Stainless a single list endpoint to expose as a tool.
2. **Patch note action sub-resources** – Normalize every side-effecting action under `/patch-notes/{id}/…`:
   - `/process` for the AI/statistics pipeline (currently `/process`).
   - `/video` for render (present `/render-video` + `/regenerate-video`) with `mode=auto|regenerate` and `GET` for status instead of `/video-status`.
   - `/deliveries/email` and `/deliveries/typefully` to replace `/send` and `/typefully`.
   - `/ai-top-changes` for the standalone generate-video-top3 helper.
3. **Async job tracking** – Introduce a generic `/jobs/{jobId}` resource returned by long-running workflows (`process`, `video`). This avoids bespoke polling endpoints like `/video-status` and brings Remotion’s polling model in line with other background tasks.
4. **Template CRUD normalization** – Use `/ai-templates` with explicit `GET/POST` and `/ai-templates/{id}` with `GET/PATCH/DELETE`, mirroring the Supabase table shape and simplifying Stainless exposure.
5. **Subscriber resource modeling** – Switch from `DELETE /api/subscribers?email=` to `/subscribers/{subscriberId}` with standard verbs, keeping Resend plumbing behind the API.

The OpenAPI spec written below reflects these consolidations so that Stainless only has to reason about one canonical shape.

---

## 3. Target OpenAPI spec

The file `openapi/core-api.yaml` captures the intended REST surface (OpenAPI 3.1). Highlights:

- **Patch notes**: `/patch-notes` for CRUD plus `/patch-notes/{patchNoteId}/process`, `/patch-notes/{patchNoteId}/video`, `/patch-notes/{patchNoteId}/deliveries/*`, and `/patch-notes/{patchNoteId}/ai-top-changes`.
- **Async jobs**: `/jobs/{jobId}` for polling/canceling long-running work (referenced by process/video responses).
- **GitHub adapters**: `/github/metadata`, `/github/stats`, `/github/summaries`.
- **Ancillary resources**: `/ai-templates` + child routes, `/subscribers` + child routes.
- **Schemas**: shared representations for `PatchNote`, `PatchNoteFilters`, `VideoData`, `ProcessingStatus`, `VideoStatus`, `GitHubStatsResponse`, `SummariesResponse`, `AiTemplate`, `Subscriber`, etc.

This spec is the contract Stainless will ingest before generating SDKs/MCP endpoints. Any Next.js route refactors should align their payloads with these schemas so the UI stays a thin consumer.

---

## 4. Stainless MCP adoption plan

1. **Authenticate the CLI** – Export `STAINLESS_API_KEY` (already provisioned in the environment) and run `bunx stainless login` so the CLI can push/pull specs.
2. **Define Stainless config** – Create/extend `stainless.config.ts` with:
   ```yaml
   targets:
     typescript:
       package_name: repatch-sdk
       publish:
         npm: false  # until we’re ready
       options:
         mcp_server:
           package_name: repatch-mcp
           enable_all_resources: true
   ```
   This mirrors the doc snippet from <https://www.stainless.com/docs/guides/generate-mcp-server-from-openapi>.
3. **Seed the project** – `bunx stainless openapi push openapi/core-api.yaml` to register the new surface, then `bunx stainless pull` to generate the base TypeScript SDK + MCP subpackage under `packages/mcp-server`.
4. **Iterate on tooling metadata** – Use Stainless’ UI or `stainless.config.ts` overrides to fine-tune tool names/descriptions, set `enable_all_resources` filters, and flag which endpoints should become MCP tools (e.g., omit destructive routes by default).
5. **Decide on distribution**:
   - For local workflows, instruct developers to run `npx -y repatch-mcp@latest`.
   - For hosted MCP servers, enable the Stainless-hosted option or publish Docker images via the config (`mcp_server.publish.docker.image_name = "repatch/mcp"`), as described in the docs.
6. **Wire up clients** – Document how Claude Desktop, Cursor, and other MCP consumers can point to the generated `.mcp` manifest (Stainless emits an `MCPB` file with every release).
7. **Automate CI** – Extend release workflows to run `bunx stainless openapi push` on schema changes and to publish the MCP package alongside the existing Next.js deploys.

These steps keep Stainless as the “management layer” requested in the brief: the OpenAPI spec remains the source of truth, Stainless generates both SDK + MCP adapters, and the MCP server simply mirrors the REST API without duplicating logic.

---

## 5. Polling & long-running workflows (Remotion Lambda, etc.)

- **Job records**: every `processPatchNote` or `renderVideo` call should create a job entry (ID returned in the OpenAPI responses). Jobs track `type` (`processing`, `video`), `state` (`pending`, `running`, `completed`, `failed`, `cancelled`), `progress` (0–100), and `resultRef` (e.g., `patchNoteId` or `videoUrl`).
- **Status endpoint**: `/jobs/{jobId}` (and the `GET /patch-notes/{id}/video` alias in the spec) becomes the canonical polling location. The frontend and MCP tools can poll this endpoint instead of bespoke Supabase queries.
- **Callbacks / fan-out**: when Remotion finishes (see `lib/remotion-lambda-renderer.ts`), we already persist `video_url` + `processing_status`. Extend that code to also mark the job complete so polling resolves with a final `videoUrl`.
- **Backoff guidance**: document recommended polling cadence (e.g., exponential backoff up to 30s) and maximum TTL before jobs auto-expire.
- **Cancellation**: `DELETE /jobs/{jobId}` (also captured in the spec) should flip the job to `cancelled`, set the patch note’s `processing_status` to `failed`, and, if applicable, issue a cancellation to Remotion Lambda (if supported).

This abstraction makes Remotion’s intermittent checks look like any other MCP-friendly “tool” that returns progress, while still relying on Supabase + AWS for the actual heavy lifting.

---

## 6. Implementation starting point & next steps

What’s done now:

- Added this architecture brief (`docs/core-api-separation.md`) plus the first-pass OpenAPI document at `openapi/core-api.yaml`.
- Captured consolidation decisions and mapped every current API route to a future REST resource so engineers can begin refactoring handlers.
- Defined schemas for Stainless to consume, ensuring parity between Supabase tables/types and the future API payloads.

Next implementation steps:

1. Align existing App Router routes with the spec (use Zod/validator middlewares to enforce the new shapes).
2. Introduce a `jobs` table/model and update `processPatchNote`/`renderVideo` to emit job IDs.
3. Create `stainless.config.ts`, run the Stainless CLI (with the env-provided API key), and generate the MCP server package.
4. Publish early MCP builds (even locally via `npx repatch-mcp@latest`) so we can validate patch note workflows inside MCP-capable clients like Claude Desktop.

This gives the team a concrete, documented starting point for splitting the “core API” from the UI layer and onboarding Stainless + MCP as the primary integration surface.

