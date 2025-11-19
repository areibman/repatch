# API Separation Plan for MCP Integration

## Overview
This document outlines the plan to separate core API functionalities from the Next.js frontend to enable MCP (Model Context Protocol) integration using Stainless.

## 1. Current API Structure Analysis

### Core API Groups

#### A. GitHub Integration APIs
**Purpose**: Fetch GitHub repository metadata and statistics

1. **GET /api/github/branches** - List repository branches
2. **GET /api/github/labels** - List repository labels  
3. **GET /api/github/releases** - List repository releases
4. **GET /api/github/tags** - List repository tags
5. **GET /api/github/stats** - Fetch commit statistics (with filters)
6. **POST /api/github/stats** - Fetch commit statistics (body-based)
7. **POST /api/github/summarize** - AI-summarize commits (2min timeout)

**Current Issues**: 
- Similar endpoints with different HTTP methods (GET vs POST for stats)
- All require owner/repo parameters
- Can be unified into a cleaner GitHub resource API

#### B. Patch Notes APIs
**Purpose**: CRUD operations for patch notes and video generation

1. **GET /api/patch-notes** - List all patch notes
2. **POST /api/patch-notes** - Create new patch note
3. **GET /api/patch-notes/[id]** - Get single patch note
4. **PUT /api/patch-notes/[id]** - Update patch note
5. **DELETE /api/patch-notes/[id]** - Delete patch note
6. **POST /api/patch-notes/[id]/process** - Process patch note with AI (5min timeout)
7. **POST /api/patch-notes/[id]/render-video** - Start video render (1min timeout)
8. **GET /api/patch-notes/[id]/video-status** - Check video render status (30s timeout)

**Current Issues**:
- Video rendering is async (polling-based)
- Process endpoint has long timeout (5min) - could be async job
- Mixed concerns (CRUD + processing + video generation)

#### C. AI Templates APIs
**Purpose**: Manage AI prompt templates

1. **GET /api/ai-templates** - List all templates
2. **POST /api/ai-templates** - Create template
3. **PUT /api/ai-templates/[id]** - Update template
4. **DELETE /api/ai-templates/[id]** - Delete template

**Status**: Clean CRUD, can stay as-is

#### D. Subscribers APIs
**Purpose**: Manage email subscribers via Resend

1. **GET /api/subscribers** - List subscribers
2. **POST /api/subscribers** - Add subscriber
3. **PUT /api/subscribers** - Update subscriber
4. **DELETE /api/subscribers** - Remove subscriber

**Status**: Clean CRUD, can stay as-is

## 2. Proposed Unified API Structure

### Group 1: GitHub Repository API
**Base Path**: `/api/v1/github/repositories/{owner}/{repo}`

```
GET    /api/v1/github/repositories/{owner}/{repo}/branches
GET    /api/v1/github/repositories/{owner}/{repo}/labels
GET    /api/v1/github/repositories/{owner}/{repo}/releases
GET    /api/v1/github/repositories/{owner}/{repo}/tags
GET    /api/v1/github/repositories/{owner}/{repo}/stats
POST   /api/v1/github/repositories/{owner}/{repo}/commits/summarize
```

**Benefits**:
- Cleaner URL structure with resource-based paths
- Owner/repo in path instead of query params
- Single stats endpoint (POST only for complex filters)

### Group 2: Patch Notes API
**Base Path**: `/api/v1/patch-notes`

```
GET    /api/v1/patch-notes
POST   /api/v1/patch-notes
GET    /api/v1/patch-notes/{id}
PUT    /api/v1/patch-notes/{id}
DELETE /api/v1/patch-notes/{id}
POST   /api/v1/patch-notes/{id}/jobs/process
POST   /api/v1/patch-notes/{id}/jobs/render-video
GET    /api/v1/patch-notes/{id}/jobs/{jobId}/status
```

**Benefits**:
- Jobs are explicitly named as async operations
- Video status polling uses generic job status endpoint
- Clear separation between sync CRUD and async jobs

### Group 3: Jobs API (Unified Async Operations)
**Base Path**: `/api/v1/jobs`

```
GET    /api/v1/jobs/{jobId}
GET    /api/v1/jobs/{jobId}/status
POST   /api/v1/jobs/{jobId}/cancel
```

**Benefits**:
- Universal job tracking across all async operations
- Can poll any job status (video render, AI processing, etc.)
- Supports cancellation for long-running tasks

### Group 4: Templates & Subscribers (Unchanged)
```
# AI Templates
GET    /api/v1/templates
POST   /api/v1/templates
PUT    /api/v1/templates/{id}
DELETE /api/v1/templates/{id}

# Subscribers
GET    /api/v1/subscribers
POST   /api/v1/subscribers
PUT    /api/v1/subscribers
DELETE /api/v1/subscribers
```

## 3. Handling Polling-Based Operations

### Current Polling Flow (Video Render)
1. Client calls `POST /api/patch-notes/[id]/render-video`
2. Server starts Remotion Lambda render job
3. Returns `{ renderId, bucketName }`
4. Client polls `GET /api/patch-notes/[id]/video-status`
5. Server checks Lambda progress via `getRenderProgress()`
6. Returns status: `pending|rendering|completed|failed`

### Proposed Unified Job System

#### Job Lifecycle
```typescript
type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface Job {
  id: string;
  type: 'video_render' | 'ai_process' | 'commit_summarize';
  status: JobStatus;
  progress: number; // 0-100
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

#### Database Schema Addition
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  metadata JSONB, -- job-specific data (renderId, bucketName, etc.)
  result JSONB, -- final result
  error TEXT,
  resource_type TEXT, -- 'patch_note', 'repository', etc.
  resource_id TEXT, -- foreign key to resource
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

#### API Flow
1. **Start Job**: `POST /api/v1/patch-notes/{id}/jobs/render-video`
   - Creates job record in DB
   - Starts async process (Lambda, AI, etc.)
   - Returns `{ jobId, status: 'pending' }`

2. **Poll Status**: `GET /api/v1/jobs/{jobId}`
   - Returns current job state
   - For video renders: queries Lambda progress
   - Updates DB with latest progress

3. **Get Result**: When `status === 'completed'`
   - `result` field contains final output
   - For videos: `{ videoUrl, duration, size }`

#### Benefits
- Single polling endpoint for all async operations
- Job history/audit trail
- Can show all jobs in a dashboard
- Supports retries and cancellation
- MCP-friendly (stateless, resource-based)

## 4. OpenAPI Specification Structure

```yaml
openapi: 3.1.0
info:
  title: Repatch API
  version: 1.0.0
  description: Core API for GitHub patch note generation and video rendering

servers:
  - url: https://api.repatch.com/v1
    description: Production
  - url: http://localhost:3000/api/v1
    description: Development

paths:
  # GitHub APIs
  /github/repositories/{owner}/{repo}/branches: ...
  /github/repositories/{owner}/{repo}/stats: ...
  
  # Patch Notes APIs
  /patch-notes: ...
  /patch-notes/{id}: ...
  
  # Jobs APIs  
  /jobs/{jobId}: ...
  
components:
  schemas:
    PatchNote: ...
    Job: ...
    GitHubStats: ...
  securitySchemes:
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key
```

## 5. Stainless MCP Integration Plan

### Phase 1: Core API Separation
1. Create `/lib/api/` directory with pure business logic
2. Extract all route logic into service functions
3. Create TypeScript SDK using Stainless CLI
4. Generate OpenAPI spec from TypeScript types

### Phase 2: MCP Server Generation
1. Use Stainless CLI: `stainless mcp generate`
2. Creates MCP server wrapper around API
3. Exposes resources and tools to LLMs
4. Supports streaming, polling, and webhooks

### Phase 3: Deployment
1. Deploy MCP server as separate service
2. Register with MCP registry
3. Frontend can use TypeScript SDK
4. LLMs can use MCP protocol

### Stainless CLI Commands
```bash
# Install Stainless CLI
npm install -g stainless-cli

# Generate TypeScript SDK from OpenAPI
stainless generate --openapi openapi.yaml --output ./sdk

# Generate MCP server
stainless mcp generate --openapi openapi.yaml --output ./mcp-server

# Test MCP server locally
stainless mcp test
```

## 6. Implementation Phases

### Phase 1: Core API Layer (Week 1)
- [ ] Create `/lib/api/` directory structure
- [ ] Extract business logic from route handlers
- [ ] Add job management system
- [ ] Update database schema

### Phase 2: Unified Routes (Week 1-2)
- [ ] Create `/app/api/v1/` structure
- [ ] Implement unified GitHub endpoints
- [ ] Implement job-based async operations
- [ ] Add comprehensive error handling

### Phase 3: OpenAPI & SDK (Week 2)
- [ ] Generate OpenAPI spec
- [ ] Use Stainless to generate TypeScript SDK
- [ ] Update frontend to use SDK
- [ ] Add API authentication

### Phase 4: MCP Integration (Week 3)
- [ ] Generate MCP server with Stainless
- [ ] Test with Claude/GPT via MCP protocol
- [ ] Deploy MCP server
- [ ] Documentation & examples

## 7. Migration Strategy

### Backward Compatibility
- Keep old routes active during migration
- Add deprecation warnings
- Dual-write to new API structure
- Remove old routes after 3 months

### Testing Strategy
- Unit tests for all API functions
- Integration tests for job polling
- E2E tests for video rendering flow
- Load tests for concurrent jobs

## 8. Benefits Summary

### For Developers
- Clean, resource-based API structure
- Type-safe SDK generation
- Better testability
- Clearer async operation handling

### For LLMs (via MCP)
- Standardized resource access
- Polling-friendly job system
- Clear schema definitions
- Streaming support for long operations

### For Users
- Faster API responses (offload to jobs)
- Better progress tracking
- Can cancel long operations
- Historical job data
