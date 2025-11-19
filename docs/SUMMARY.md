# API Separation for MCP - Implementation Summary

## Overview

This document summarizes the work done to separate the core API from the frontend and prepare for MCP (Model Context Protocol) integration using Stainless.

## What Was Accomplished

### 1. ✅ Comprehensive API Documentation
- **File**: `docs/API_ARCHITECTURE.md`
- Documented all 17 existing API endpoints
- Identified separable functionalities (read-only, mutations, AI operations)
- Proposed unified endpoint structure
- Designed architecture for polling-based operations
- Created implementation roadmap

### 2. ✅ OpenAPI 3.1 Specification
- **File**: `openapi.yaml`
- Complete specification with all endpoints
- Request/response schemas
- Error handling patterns
- Webhook documentation for async operations
- Job-based async operation design
- Examples and descriptions

### 3. ✅ Core API Layer
- **Directory**: `lib/api-core/`
- Framework-agnostic business logic
- Consistent `Result<T>` types for error handling
- Job queue system (in-memory, ready for production queue)
- Unified GitHub metadata endpoint
- Job processor for async operations

**Key Files**:
- `lib/api-core/types/result.ts` - Result type system
- `lib/api-core/types/job.ts` - Job types and interfaces
- `lib/api-core/github/metadata.ts` - Unified metadata endpoint
- `lib/api-core/jobs/job-store.ts` - Job storage (in-memory)
- `lib/api-core/jobs/job-processor.ts` - Job processing logic

### 4. ✅ V1 API Routes
- **Directory**: `app/api/v1/`
- Versioned API endpoints using core layer
- Clean separation from Next.js concerns
- Ready for MCP integration

**Endpoints**:
- `GET /api/v1/github/metadata` - Unified GitHub metadata
- `POST /api/v1/jobs` - Create async job
- `GET /api/v1/jobs` - List jobs
- `GET /api/v1/jobs/[id]` - Get job status
- `DELETE /api/v1/jobs/[id]` - Cancel job

### 5. ✅ Comprehensive Documentation

**Files**:
- `docs/API_ARCHITECTURE.md` - Architecture and design decisions
- `docs/IMPLEMENTATION_GUIDE.md` - Step-by-step implementation guide
- `docs/MCP_INTEGRATION.md` - MCP integration with Claude Desktop
- `app/api/v1/README.md` - API v1 user guide
- `lib/api-core/README.md` - Core API layer documentation

### 6. ✅ Test Suite
- **File**: `scripts/test-api-v1.ts`
- Tests for GitHub metadata endpoint
- Tests for job lifecycle (create, get, list, cancel)
- Error handling tests
- Can be run with: `bun run test:api`

## Architecture Highlights

### Before: Tight Coupling
```
Frontend → Next.js Routes → Mixed Logic (HTTP + Business)
```

### After: Clean Separation
```
Frontend → Next.js Routes ─┐
                           ├→ Core API (pure business logic)
MCP Server ────────────────┘
CLI Tools ─────────────────┘
```

### Job-Based Async Operations

Instead of:
```typescript
POST /api/patch-notes/[id]/render-video  // Start render
GET /api/patch-notes/[id]/video-status   // Poll status
```

Now:
```typescript
POST /api/v1/jobs { type: 'render-video', params: {...} }  // Create job
GET /api/v1/jobs/[id]                                       // Poll status (unified)
```

Benefits:
- ✅ Unified polling interface for all async operations
- ✅ Better job tracking and management
- ✅ Webhook support for completion notifications
- ✅ Retry and error handling built-in
- ✅ Observable and debuggable

## Key Design Decisions

### 1. Result Type Pattern
All core API functions return `Result<T>`:
```typescript
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string };
```

Benefits:
- Explicit error handling
- Type-safe results
- Easy composition
- Framework agnostic

### 2. Job Queue System
Async operations (video rendering, AI processing) use a job queue:
- Jobs have lifecycle: queued → processing → completed/failed
- Progress tracking (0-100%)
- Webhook notifications on completion
- In-memory for now, ready for Redis/PostgreSQL

### 3. Unified Endpoints
Combined related operations:
- `GET /api/v1/github/metadata?include=branches,labels,releases,tags`
- Reduces API calls
- Parallel fetching
- Single request for repository setup

### 4. Versioned API
All new endpoints under `/api/v1`:
- Future-proof
- Can deprecate old endpoints gradually
- Clear separation from frontend routes

## Polling Architecture for Video Rendering

### Current Problem
- Frontend polls every 5 seconds
- Each poll calls Remotion Lambda
- Inefficient and costly

### Solution: Job-Based Approach

```typescript
// 1. Create job (returns immediately)
const job = await fetch('/api/v1/jobs', {
  method: 'POST',
  body: JSON.stringify({
    type: 'render-video',
    params: { patchNoteId: '123' }
  })
});

// 2. Job processor handles Lambda interaction
// - Calls Remotion Lambda
// - Stores render ID in database
// - Updates job progress

// 3. Frontend polls job status (not Lambda directly)
const status = await fetch(`/api/v1/jobs/${job.id}`);
// { status: 'processing', progress: 75 }

// 4. Job processor polls Lambda internally
// - Updates job progress
// - Stores video URL when complete
// - Calls webhook if provided

// 5. Frontend gets completion
// { status: 'completed', result: { videoUrl: '...' } }
```

Benefits:
- Server-side polling (more efficient)
- Unified interface (all async ops)
- Webhook support (no polling needed)
- Better observability

## Next Steps

### Immediate (Phase 1)
- [ ] Test the v1 API locally
- [ ] Migrate existing frontend to use v1 endpoints (optional)
- [ ] Add authentication (API keys)

### Short-term (Phase 2)
- [ ] Replace in-memory job store with Redis/PostgreSQL
- [ ] Implement webhook signatures (HMAC)
- [ ] Add rate limiting
- [ ] Set up monitoring (Sentry, DataDog)

### Medium-term (Phase 3)
- [ ] Generate MCP server with Stainless
- [ ] Test MCP integration with Claude Desktop
- [ ] Deploy MCP server
- [ ] Document MCP usage patterns

### Long-term (Phase 4)
- [ ] Generate SDK clients (TypeScript, Python)
- [ ] Migrate remaining endpoints to v1
- [ ] Deprecate old endpoints
- [ ] Add more MCP-friendly operations

## File Structure

```
/workspace/
├── docs/
│   ├── API_ARCHITECTURE.md         # Architecture documentation
│   ├── IMPLEMENTATION_GUIDE.md     # Implementation guide
│   ├── MCP_INTEGRATION.md          # MCP integration guide
│   └── SUMMARY.md                  # This file
├── lib/
│   └── api-core/                   # Core API layer
│       ├── types/
│       │   ├── result.ts           # Result type
│       │   └── job.ts              # Job types
│       ├── github/
│       │   ├── metadata.ts         # Unified metadata
│       │   └── index.ts
│       ├── jobs/
│       │   ├── job-store.ts        # Job storage
│       │   ├── job-processor.ts    # Job processing
│       │   └── index.ts
│       ├── README.md
│       └── index.ts
├── app/
│   └── api/
│       └── v1/                     # V1 API routes
│           ├── github/
│           │   └── metadata/
│           │       └── route.ts    # Unified metadata endpoint
│           ├── jobs/
│           │   ├── route.ts        # List/create jobs
│           │   └── [id]/
│           │       └── route.ts    # Get/cancel job
│           └── README.md           # API documentation
├── scripts/
│   └── test-api-v1.ts              # Test suite
├── openapi.yaml                     # OpenAPI 3.1 spec
└── package.json                     # Added test:api script
```

## Usage Examples

### 1. Test the API

```bash
# Make sure dev server is running
bun dev

# In another terminal, run tests
bun run test:api
```

### 2. Create a Job

```bash
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generate-video-top-changes",
    "params": {
      "content": "# Release 1.0\n\n- New feature A\n- Bug fix B",
      "repoName": "my-app"
    }
  }'
```

### 3. Check Job Status

```bash
curl http://localhost:3000/api/v1/jobs/{job-id}
```

### 4. Fetch GitHub Metadata

```bash
curl "http://localhost:3000/api/v1/github/metadata?owner=facebook&repo=react&include=branches,releases"
```

## Testing Strategy

### Unit Tests
Test core API functions in isolation:
```typescript
import { getGitHubMetadata } from '@/lib/api-core';

test('should fetch branches', async () => {
  const result = await getGitHubMetadata({
    owner: 'facebook',
    repo: 'react',
    include: ['branches']
  });
  
  expect(result.success).toBe(true);
  expect(result.data.branches).toBeDefined();
});
```

### Integration Tests
Test API routes end-to-end:
```bash
bun run test:api
```

### MCP Tests
Test MCP integration with Claude Desktop:
1. Generate MCP server
2. Configure Claude Desktop
3. Try prompts in Claude
4. Verify API calls in logs

## Performance Considerations

### Before
- Frontend polls video status every 5s
- Each poll = 1 API call to Next.js + 1 call to Lambda
- 60-second video = 12 API calls

### After
- Server polls Lambda internally
- Frontend polls job status (cached)
- Job status updates every 10s
- 60-second video = 6 internal polls, unlimited frontend polls (cached)

### Improvements
- 50% reduction in Lambda calls
- Frontend can poll aggressively (cached)
- Webhook option eliminates polling entirely

## Security Considerations

### Current State
- No authentication on v1 endpoints (development only)
- Webhooks unsigned (insecure)
- No rate limiting

### Production Requirements
- [ ] Add Bearer token authentication
- [ ] Sign webhooks with HMAC-SHA256
- [ ] Rate limit per API key
- [ ] CORS configuration
- [ ] API key rotation
- [ ] Audit logging

## Monitoring & Observability

### Recommended Setup
1. **Error Tracking**: Sentry for exceptions
2. **Metrics**: DataDog/Prometheus for API metrics
3. **Logs**: Structured logging (JSON)
4. **Tracing**: OpenTelemetry for distributed tracing

### Key Metrics to Track
- Job creation rate
- Job completion time
- Job failure rate
- API response times
- Rate limit hits
- Webhook delivery success rate

## Cost Implications

### Benefits
- ✅ Reduced Lambda calls (server-side polling)
- ✅ Better caching opportunities
- ✅ Fewer redundant API calls (unified endpoints)

### Costs
- New Redis instance (if using BullMQ)
- Additional monitoring/logging infrastructure

### Estimated Savings
- ~50% reduction in Lambda calls = $X/month saved
- Unified endpoints = ~30% fewer API calls
- Total estimated savings: $Y/month

## Contributing

When adding new endpoints:

1. **Add business logic to core API**:
   ```typescript
   // lib/api-core/my-feature/my-operation.ts
   export async function myOperation(input: Input): Promise<Result<Output>> {
     // Pure business logic
   }
   ```

2. **Create API route**:
   ```typescript
   // app/api/v1/my-feature/route.ts
   import { myOperation } from '@/lib/api-core';
   
   export async function POST(request: NextRequest) {
     const body = await request.json();
     const result = await myOperation(body);
     return result.success
       ? NextResponse.json(result.data)
       : NextResponse.json({ error: result.error }, { status: 500 });
   }
   ```

3. **Update OpenAPI spec**:
   ```yaml
   # openapi.yaml
   /my-feature:
     post:
       summary: My operation
       # ... schemas
   ```

4. **Add tests**:
   ```typescript
   // scripts/test-api-v1.ts
   await test('My operation', async () => {
     // Test code
   });
   ```

## References

- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Stainless Documentation](https://stainless.com/docs)
- [BullMQ Documentation](https://docs.bullmq.io)

## Questions?

See the following docs:
- Architecture questions → `docs/API_ARCHITECTURE.md`
- Implementation help → `docs/IMPLEMENTATION_GUIDE.md`
- MCP integration → `docs/MCP_INTEGRATION.md`
- API usage → `app/api/v1/README.md`
