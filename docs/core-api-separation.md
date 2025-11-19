# Core API Separation & MCP Enablement

## Objectives
- Decouple business logic from the Next.js App Router so the same API can power the web app, MCP clients, automations, and future surfaces.
- Provide an OpenAPI-described “core API” that Stainless can ingest to generate SDKs and MCP servers.
- Preserve existing Supabase, GitHub, AI, Resend, and Remotion integrations while formalizing job lifecycle and polling semantics.

---

## 1. Core Functionality Map
| Capability | Current Route/Module | Responsibilities | External Systems |
| --- | --- | --- | --- |
| Patch note CRUD | `app/api/patch-notes` & `[id]` | Create/read/update/delete patch note rows, persist AI/meta fields | Supabase |
| Patch note processing pipeline | `app/api/patch-notes/[id]/process` + `lib/services/patch-note-processor.service.ts` | Fetch GitHub stats, run AI summarizers, update Supabase record | GitHub API, Gemini, Supabase |
| GitHub metadata | `app/api/github/*` | Branch/tag/release/label lists, stats, summarization | GitHub API |
| AI templates | `app/api/ai-templates` | CRUD templates that control summarization tone | Supabase |
| Subscribers | `app/api/subscribers` | Proxy to Resend audiences | Resend |
| Distribution | `app/api/patch-notes/[id]/send`, `/typefully` | Render HTML emails, push to Typefully | Resend, Typefully API, Supabase storage |
| Video rendering | `/patch-notes/[id]/render-video`, `/regenerate-video`, `/video-status`, `/generate-video-top3` | Start Remotion Lambda job, poll status, pre-compute top 3 changes | AWS Lambda, Supabase |

These are the “core API” candidates. Frontend-only concerns (dialogs, layout, feed filtering, etc.) stay in Next.js.

---

## 2. Unification Opportunities
| Current surface | Issue | Proposed unified endpoint |
| --- | --- | --- |
| Multiple GitHub routes (`branches`, `tags`, `labels`, `releases`, `stats`) | Redundant validation/auth and multiple network round-trips in the UI | `GET /github/repo/metadata` with an `include[]=branches&include[]=tags...` query to return a single structured payload. `POST /github/stats` stays for heavy aggregation. |
| Separate patch-note video routes (`render-video`, `regenerate-video`, `video-status`) | Start, restart, and polling split across three URLs | `/patch-notes/{id}/video` with `POST` to start (optional `mode=regenerate`) and `GET` to report polling state. |
| Distribution endpoints (`send`, `typefully`) | Similar auth, gating, and logging duplicated | `/patch-notes/{id}/publish` with `channel=email|typefully|webhook` in the body; respond with per-channel job metadata. |
| Ad-hoc background orchestration | Each long-running task returns bespoke JSON | `/jobs/{jobId}` + typed `jobType` (processing, render, publish). The patch-note and video routes respond with a `jobId`, letting clients poll a common schema (status, progress, payload, error). |
| AI template CRUD vs selection | POST/PUT/DELETE only; GET lists everything | `/ai/templates` supports filtering/pagination, `/ai/templates/{id}` handles GET/PATCH/DELETE to align with Stainless resource modeling. |
| Subscribers route mixing list/create/update/delete | Overloaded single handler complicates future auth | `/subscribers` for collection operations, `/subscribers/{id}` (or `/subscribers/by-email/{email}`) for mutation, allowing RBAC scopes per verb. |

---

## 3. Target OpenAPI Surface
The initial spec lives at `openapi/core-api.yaml` and focuses on the smallest viable surface for Stainless:

1. **Patch notes** – CRUD plus `/process` to kick off a processing job and `/video` to kick off rendering. All long-running mutations respond with a `Job` resource.
2. **Jobs** – `/jobs/{jobId}` exposes a normalized status enum (`pending`, `running`, `succeeded`, `failed`) plus type-specific payloads (`processing`, `videoRender`, `publishEmail`, etc.).
3. **GitHub metadata & stats** – `GET /github/repo/metadata`, `GET/POST /github/stats`.
4. **AI templates** – Standard CRUD.
5. **Subscribers** – List/create/update/delete contacts stored in Resend.
6. **Publishing** – `/patch-notes/{id}/publish` with a `channel` enum to cover email + Typefully, paving the way for Slack/webhook expansions.

The spec models Supabase IDs as UUID strings, uses JSON schema enums for filters (`preset`, `mode`, `jobStatus`), and documents authentication via bearer token (Stainless can later swap auth headers). It intentionally separates synchronous vs. async responses to keep Stainless-generated MCP tools predictable.

---

## 4. Plan Beyond “Just Separate and Use Stainless”
1. **Staged extraction**
   - Phase 0: Keep Next.js routes as adapters but call the new internal “core API” module (shared zod validators + service layer) to ensure parity.
   - Phase 1: Deploy the core API (e.g., as a lightweight Bun/Hono service or Next.js `app/api/core/*` namespace) with the same Supabase + AI credentials; the frontend switches to those endpoints via `lib/core-client`.
   - Phase 2: Retire direct Supabase access from the UI once all read/write paths flow through the core API.
2. **Contract-first development**
   - Maintain `openapi/core-api.yaml` as the truth; run `bunx openapi-format` (or Stainless CLI) in CI.
   - Use Stainless to generate a TypeScript SDK (`packages/core-sdk`) plus MCP server subpackage (`packages/mcp-server`) so Cursor/Claude can call the API via tools.
3. **Governance & auth**
   - Introduce machine tokens (service users) scoped per capability (read-only stats vs. mutation).
   - Use Stainless’ filtering (`--operation=read`) to expose only safe defaults to MCP clients; dynamic tools unlock writing.
4. **Observability & retries**
   - When wrapping long-running jobs, emit structured events (Supabase channel, Postgres notifications, or Redis streams) so the frontend can transition from polling to SSE/WebSockets later.
5. **Rollout plan**
   - Ship the spec + Stainless config in this branch.
   - Next PR: implement `/core` API routes backed by existing service functions and wire the UI to them progressively (feature flag per surface).
   - Parallel effort: configure Stainless project (CLI `stainless project bootstrap --spec openapi/core-api.yaml`) using the API key already provisioned; publish MCP server after first stable spec.

---

## 5. Polling & Lambda Job Strategy
- **Job registry**: Store jobs in Supabase (`core_jobs` table) keyed by UUID with `type`, `status`, `progress`, `payload`, and `externalRef` (e.g., Remotion render ID). Every async route writes to this table and returns the job.
- **Video rendering**: `/patch-notes/{id}/video` kicks off `renderVideo` (Remotion Lambda). A background worker (cron or queue consumer) polls `getRenderProgress` and updates the job row + patch note record. Clients either poll `/jobs/{jobId}` or subscribe once SSE/webhooks exist.
- **Processing pipeline**: `/patch-notes/{id}/process` enqueues a job that runs the existing `processPatchNote` service. Intermediate stages update `Job.progress` + `Job.details` so MCP clients can surface “Analyzing commits…”.
- **Publishing**: Email/Typefully actions also produce jobs; success payload contains Resend message IDs or Typefully draft URLs.
- **Extensibility**: Because jobs share a schema, Stainless’ MCP wrapper can expose a single `get_job_status` tool and reason about any async workflow without custom instructions.

---

## Immediate Next Steps
1. Track the OpenAPI spec in source control and gate merges on validation.
2. Land a minimal Stainless config (TypeScript target + MCP subpackage) once CLI access is wired up; document commands (`STAINLESS_API_KEY=... npx stainless generate`).
3. Build a `lib/core-api-client.ts` inside the Next app that consumes the generated SDK so frontend calls are already spec-compliant.
4. Add Supabase migrations for the `core_jobs` table and emit job IDs from the existing services as an interim step.

This document should be updated as the spec evolves or new surfaces (Slack, MCP dynamic tools, Cloudflare worker) come online.

