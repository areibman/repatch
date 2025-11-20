# API Architecture Documentation

## Overview
This document outlines the current API structure and proposes a separation architecture for enabling Model Context Protocol (MCP) integration via Stainless.

## Current API Endpoints

### 1. AI Templates API (`/api/ai-templates`)
**Purpose**: Manage AI prompt templates for patch note generation

**Endpoints**:
- `GET /api/ai-templates` - List all templates
- `POST /api/ai-templates` - Create a new template
- `PUT /api/ai-templates/[id]` - Update a template
- `DELETE /api/ai-templates/[id]` - Delete a template

**Core Functionality**:
- CRUD operations on AI templates
- Templates stored in Supabase
- Used by patch note generation to customize AI output

---

### 2. GitHub API (`/api/github/*`)
**Purpose**: Fetch GitHub repository data

**Endpoints**:
- `GET /api/github/branches` - List repository branches
  - Query params: `owner`, `repo`
- `GET /api/github/labels` - List repository labels
  - Query params: `owner`, `repo`
- `GET /api/github/releases` - List repository releases
  - Query params: `owner`, `repo`
- `GET /api/github/tags` - List repository tags
  - Query params: `owner`, `repo`
- `GET /api/github/stats` - Get repository statistics
  - Query params: `owner`, `repo`, `branch`, `timePeriod`, `since`, `until`
- `POST /api/github/stats` - Get stats with advanced filters
  - Body: `{ owner, repo, branch, filters }`
- `POST /api/github/summarize` - Summarize commits with AI
  - Body: `{ owner, repo, branch, filters, templateId }`
  - Max duration: 120s

**Core Functionality**:
- GitHub API integration via Octokit
- Caching and rate limiting
- Commit/PR statistics aggregation
- AI-powered commit summarization

---

### 3. Patch Notes API (`/api/patch-notes`)
**Purpose**: Manage patch notes lifecycle

**Endpoints**:
- `GET /api/patch-notes` - List all patch notes
- `POST /api/patch-notes` - Create a new patch note
- `GET /api/patch-notes/[id]` - Get a single patch note
- `PUT /api/patch-notes/[id]` - Update a patch note
- `DELETE /api/patch-notes/[id]` - Delete a patch note
- `POST /api/patch-notes/[id]/process` - Process pending patch note
  - Max duration: 300s (5 min)
  - Body: `{ owner, repo, repoUrl, branch, filters, templateId }`
- `POST /api/patch-notes/[id]/render-video` - Start video rendering
  - Max duration: 60s
- `GET /api/patch-notes/[id]/video-status` - Check video render status
  - Max duration: 30s
  - **Polling-based**: Frontend polls this endpoint every 5s
- `POST /api/patch-notes/[id]/send` - Send patch note via email
  - Sends to all active subscribers via Resend
- `POST /api/patch-notes/generate-video-top3` - Generate top 3 changes for video
  - Max duration: 90s
  - Body: `{ content, repoName }`

**Core Functionality**:
- CRUD operations on patch notes
- Background processing pipeline:
  1. Fetch GitHub stats
  2. Analyze commits with AI
  3. Generate content
  4. Create video data
  5. Render video (async via Remotion Lambda)
  6. Poll video status until complete
- Email distribution via Resend
- Video generation via Remotion Lambda

---

### 4. Subscribers API (`/api/subscribers`)
**Purpose**: Manage email subscribers

**Endpoints**:
- `GET /api/subscribers` - List all subscribers
- `POST /api/subscribers` - Add a new subscriber
  - Body: `{ email, firstName?, lastName? }`
- `PUT /api/subscribers` - Update subscriber
  - Body: `{ email?, id?, unsubscribed }`
- `DELETE /api/subscribers` - Remove subscriber
  - Query params: `email` or `id`

**Core Functionality**:
- Integration with Resend audience management
- Subscriber status management
- Email validation

---

## Core API Functionalities (Separable)

### Category 1: Data Retrieval (Read-Only)
These are stateless, read-only operations suitable for MCP:

1. **GitHub Data Fetching**
   - Branch listing
   - Label listing
   - Release listing
   - Tag listing
   - Repository statistics (with time filtering)
   
2. **Patch Note Retrieval**
   - List all patch notes
   - Get single patch note
   - Get video render status (polling endpoint)

3. **Template Retrieval**
   - List all AI templates
   - Get single template

4. **Subscriber Retrieval**
   - List all subscribers

### Category 2: Data Mutation (Write Operations)
These modify state and may have side effects:

1. **Patch Note Lifecycle**
   - Create patch note
   - Update patch note
   - Delete patch note
   - Process patch note (long-running)
   
2. **Video Operations**
   - Render video (async job initiation)
   - Generate video top changes
   
3. **Communication**
   - Send patch note email
   
4. **Template Management**
   - Create/update/delete templates
   
5. **Subscriber Management**
   - Add/update/remove subscribers

### Category 3: AI & Computation (Expensive Operations)
These involve AI models or long-running computations:

1. **AI Summarization**
   - Commit summarization with AI templates
   - Video top changes generation from content
   
2. **Video Rendering**
   - Remotion Lambda video generation (polling-based)

---

## Unified Endpoint Opportunities

### 1. **GitHub Metadata Endpoint** (Unified)
Combine all GitHub read-only endpoints into one:

```
GET /api/github/metadata?owner=x&repo=y&include=branches,labels,releases,tags
```

Benefits:
- Single request for repository setup
- Reduced network overhead
- Parallel data fetching

### 2. **Patch Note Operations Endpoint** (RESTful)
Already well-designed as REST:
- `GET /api/patch-notes` - List
- `POST /api/patch-notes` - Create
- `GET /api/patch-notes/[id]` - Read
- `PUT /api/patch-notes/[id]` - Update
- `DELETE /api/patch-notes/[id]` - Delete

### 3. **Patch Note Actions Endpoint** (Unified Actions)
Group all patch note actions under a single endpoint:

```
POST /api/patch-notes/[id]/actions
Body: { action: "process" | "render-video" | "send-email" | "generate-top-changes", ...params }
```

Benefits:
- Single action endpoint with type discrimination
- Easier to extend with new actions
- Consistent error handling

### 4. **Async Jobs Endpoint** (Job Management)
Unified endpoint for all async operations:

```
POST /api/jobs - Create a job (process, render-video, etc.)
GET /api/jobs/[id] - Get job status
GET /api/jobs - List jobs
DELETE /api/jobs/[id] - Cancel job
```

Benefits:
- Consistent polling interface
- Job queueing and retry logic
- Better observability

---

## Polling-Based Endpoints: Video Rendering

### Current Architecture
1. **Initiation**: `POST /api/patch-notes/[id]/render-video`
   - Starts Remotion Lambda render job
   - Returns immediately with `{ renderId, bucketName }`
   - Updates DB: `processing_status = 'generating_video'`

2. **Status Polling**: `GET /api/patch-notes/[id]/video-status`
   - Frontend polls every 5 seconds
   - Calls `getRenderProgress()` on Remotion Lambda
   - Returns: `{ status: 'pending' | 'rendering' | 'completed' | 'failed', progress: 0-100, videoUrl?, error? }`

3. **Completion**:
   - When `status === 'completed'`, video URL is stored in DB
   - Polling stops

### Issues with Current Approach
1. **Client-side polling burden**: Frontend must maintain polling logic
2. **Rate limiting concerns**: Each poll is an API call to Lambda
3. **No retry logic**: If a poll fails, status is lost
4. **Resource inefficient**: Constant HTTP requests

### Proposed Architecture for MCP

#### Option A: Server-Side Job Queue (Recommended)
Use a job queue (e.g., BullMQ with Redis) to handle async operations:

```typescript
// Job creation
POST /api/jobs
{
  type: 'render-video',
  patchNoteId: '123',
  priority: 'normal'
}
Response: { jobId: 'job-456', status: 'queued' }

// Job status
GET /api/jobs/job-456
Response: {
  id: 'job-456',
  type: 'render-video',
  status: 'processing' | 'completed' | 'failed',
  progress: 75,
  result?: { videoUrl: '...' },
  error?: string
}

// Job webhook (optional)
Webhook to /api/webhooks/jobs when complete
```

Benefits:
- Server handles all polling logic internally
- Retry and error handling built-in
- Better observability and logging
- Webhook notifications on completion
- MCP clients don't need to poll

#### Option B: WebSocket/SSE Streaming
Real-time updates via WebSocket or Server-Sent Events:

```typescript
// Connect to job stream
GET /api/jobs/job-456/stream
// Server pushes updates:
data: { status: 'processing', progress: 25 }
data: { status: 'processing', progress: 50 }
data: { status: 'completed', videoUrl: '...' }
```

Benefits:
- Real-time updates without polling
- Lower latency
- Efficient network usage

Drawbacks:
- More complex infrastructure
- Not all MCP clients support WebSockets
- Requires persistent connections

#### Option C: Callback URLs (MCP-Friendly)
Client provides a callback URL when starting the job:

```typescript
POST /api/jobs
{
  type: 'render-video',
  patchNoteId: '123',
  callbackUrl: 'https://client.com/webhook'
}

// Server calls back when done:
POST https://client.com/webhook
{
  jobId: 'job-456',
  status: 'completed',
  videoUrl: '...'
}
```

Benefits:
- No polling needed
- Works with any HTTP client
- MCP-friendly

Drawbacks:
- Requires client to expose webhook endpoint
- Security considerations (HMAC signing needed)

---

## Recommended Unified API Structure

### Core API Layer (`/api/v1`)
Separated from Next.js frontend, suitable for MCP:

```
/api/v1
├── /github
│   ├── GET /metadata          # Unified: branches, labels, releases, tags
│   ├── GET /stats             # Repository statistics
│   └── POST /summarize        # AI summarization
├── /patch-notes
│   ├── GET /                  # List patch notes
│   ├── POST /                 # Create patch note
│   ├── GET /{id}              # Get patch note
│   ├── PUT /{id}              # Update patch note
│   ├── DELETE /{id}           # Delete patch note
│   └── POST /{id}/send        # Send email
├── /templates
│   ├── GET /                  # List templates
│   ├── POST /                 # Create template
│   ├── GET /{id}              # Get template
│   ├── PUT /{id}              # Update template
│   └── DELETE /{id}           # Delete template
├── /subscribers
│   ├── GET /                  # List subscribers
│   ├── POST /                 # Add subscriber
│   ├── PUT /{id}              # Update subscriber
│   └── DELETE /{id}           # Remove subscriber
└── /jobs
    ├── POST /                 # Create job (process, render-video, etc.)
    ├── GET /                  # List jobs
    ├── GET /{id}              # Get job status
    ├── DELETE /{id}           # Cancel job
    └── GET /{id}/stream       # Stream job updates (optional)
```

### Jobs API Design

```typescript
// Job types
type JobType = 
  | 'process-patch-note'
  | 'render-video'
  | 'generate-video-top-changes'
  | 'send-email';

// Create job
POST /api/v1/jobs
{
  type: JobType,
  params: {
    patchNoteId?: string,
    owner?: string,
    repo?: string,
    // ... type-specific params
  },
  callbackUrl?: string  // Optional webhook
}

// Job status response
{
  id: string,
  type: JobType,
  status: 'queued' | 'processing' | 'completed' | 'failed',
  progress: number,       // 0-100
  result?: any,           // Job-specific result
  error?: string,
  createdAt: string,
  updatedAt: string,
  completedAt?: string
}
```

---

## Implementation Plan with Stainless MCP

### Phase 1: API Restructuring (This PR)
1. ✅ Document current API structure
2. ✅ Identify separable endpoints
3. ✅ Design unified endpoint structure
4. Create OpenAPI specification
5. Implement core API layer (`lib/api-core/`)
6. Create API route adapters (`app/api/v1/`)

### Phase 2: Job Queue Integration
1. Install BullMQ + Redis adapter
2. Create job queue service (`lib/services/job-queue.service.ts`)
3. Implement job processors for async operations:
   - Process patch note job
   - Render video job
   - Generate video top changes job
4. Update endpoints to use job queue
5. Add webhook support for job completion

### Phase 3: OpenAPI Spec Creation
1. Generate OpenAPI 3.1 spec from TypeScript types
2. Document all endpoints with examples
3. Add authentication schemes
4. Add webhook documentation
5. Validate spec with Stainless CLI

### Phase 4: Stainless SDK Generation
1. Use Stainless to generate SDKs (TypeScript, Python, etc.)
2. Generate MCP server from OpenAPI spec
3. Test MCP integration with Claude Desktop
4. Deploy MCP server

### Phase 5: Frontend Migration
1. Replace direct API calls with generated SDK
2. Update polling logic to use job status API
3. Add webhook handling (if applicable)
4. Test end-to-end flows

---

## Security Considerations

### Authentication
- Add API key authentication for `/api/v1` endpoints
- Separate from Next.js session auth
- Support both Bearer tokens and API keys

### Rate Limiting
- Implement rate limiting per API key
- Different limits for read vs write operations
- Higher limits for authenticated users

### Webhook Security
- HMAC signature validation for webhooks
- Verify webhook payloads
- Retry logic with exponential backoff

---

## Next Steps
1. Create OpenAPI specification
2. Set up core API layer structure
3. Implement job queue service
4. Generate Stainless MCP server
5. Test MCP integration
