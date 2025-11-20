# Implementation Guide: API Separation for MCP

This guide explains the changes made to separate the core API from the Next.js frontend.

## What Was Done

### 1. Created Core API Layer (`lib/api-core/`)

A framework-agnostic business logic layer that can be called from:
- Next.js API routes
- MCP servers
- CLI tools
- Other Node.js applications

**Structure**:
```
lib/api-core/
├── types/
│   ├── result.ts         # Result<T> type for consistent error handling
│   └── job.ts            # Job types and interfaces
├── github/
│   ├── metadata.ts       # Unified GitHub metadata endpoint
│   └── index.ts
├── jobs/
│   ├── job-store.ts      # In-memory job storage (replace with Redis)
│   ├── job-processor.ts  # Async job processing
│   └── index.ts
└── index.ts              # Main exports
```

### 2. Created New V1 API Routes

New versioned API routes that use the core layer:

- `GET /api/v1/github/metadata` - Unified GitHub metadata
- `GET /api/v1/jobs` - List jobs
- `POST /api/v1/jobs` - Create job
- `GET /api/v1/jobs/[id]` - Get job status
- `DELETE /api/v1/jobs/[id]` - Cancel job

### 3. Created OpenAPI 3.1 Specification

A complete OpenAPI spec (`openapi.yaml`) documenting:
- All API endpoints
- Request/response schemas
- Authentication
- Webhooks for job completion
- Polling-based operations

### 4. Created Architecture Documentation

Comprehensive documentation in `docs/API_ARCHITECTURE.md` covering:
- Current API structure
- Separable functionalities
- Unified endpoint opportunities
- Polling architecture
- Job queue design
- Implementation roadmap

## How to Use

### Using the Jobs API

The Jobs API handles all async operations (video rendering, patch note processing, etc.):

```typescript
// 1. Create a job
const response = await fetch('/api/v1/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'render-video',
    params: { patchNoteId: '123' },
    callbackUrl: 'https://myapp.com/webhook' // optional
  })
});

const job = await response.json();
// { id: 'job_...', type: 'render-video', status: 'queued', ... }

// 2. Poll for status
const statusResponse = await fetch(`/api/v1/jobs/${job.id}`);
const status = await statusResponse.json();
// { id: 'job_...', status: 'processing', progress: 50, ... }

// 3. When complete
if (status.status === 'completed') {
  console.log('Result:', status.result);
}
```

### Using the Unified GitHub Metadata Endpoint

```typescript
// Fetch multiple metadata types in one request
const response = await fetch(
  '/api/v1/github/metadata?owner=facebook&repo=react&include=branches,releases'
);

const metadata = await response.json();
// {
//   branches: [...],
//   releases: [...]
// }
```

## Next Steps

### Phase 1: Complete Core API Migration ✅

- [x] Create core API layer
- [x] Implement job queue (in-memory)
- [x] Create v1 API routes
- [x] Create OpenAPI spec
- [ ] Migrate remaining endpoints to v1

### Phase 2: Production Job Queue

Replace the in-memory job store with a production-ready solution:

1. **Option A: BullMQ + Redis**
   ```bash
   npm install bullmq ioredis
   ```

   Benefits:
   - Battle-tested
   - Built-in retry logic
   - Persistent storage
   - Web UI for monitoring

2. **Option B: PostgreSQL-based queue**
   - Use existing Supabase database
   - Simpler infrastructure
   - Built-in with Supabase

### Phase 3: Generate MCP Server with Stainless

Once you have the Stainless API key configured:

```bash
# Validate OpenAPI spec
stainless validate openapi.yaml

# Generate MCP server
stainless generate mcp --spec openapi.yaml --output ./mcp-server

# Test MCP server locally
cd mcp-server
npm install
npm start
```

### Phase 4: Deploy MCP Server

Options:
1. **Deploy alongside Next.js** - Same vercel deployment
2. **Separate deployment** - Dedicated MCP server instance
3. **Serverless functions** - AWS Lambda, Cloudflare Workers

### Phase 5: Frontend Migration

Update the frontend to use the new job-based API:

```typescript
// Before: Direct API call with polling
const renderVideo = async (patchNoteId: string) => {
  await fetch(`/api/patch-notes/${patchNoteId}/render-video`, { method: 'POST' });
  
  // Poll for status
  const interval = setInterval(async () => {
    const status = await fetch(`/api/patch-notes/${patchNoteId}/video-status`);
    const data = await status.json();
    
    if (data.status === 'completed') {
      clearInterval(interval);
      // Handle completion
    }
  }, 5000);
};

// After: Job-based API
const renderVideo = async (patchNoteId: string) => {
  // Create job
  const response = await fetch('/api/v1/jobs', {
    method: 'POST',
    body: JSON.stringify({
      type: 'render-video',
      params: { patchNoteId }
    })
  });
  
  const job = await response.json();
  
  // Poll job status (unified endpoint for all jobs)
  const interval = setInterval(async () => {
    const status = await fetch(`/api/v1/jobs/${job.id}`);
    const data = await status.json();
    
    if (data.status === 'completed') {
      clearInterval(interval);
      // Handle completion
    }
  }, 5000);
};
```

## Testing

### Test the Jobs API

```bash
# Create a job
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generate-video-top-changes",
    "params": {
      "content": "# My Release\n\n- Added feature A\n- Fixed bug B",
      "repoName": "myrepo"
    }
  }'

# Get job status
curl http://localhost:3000/api/v1/jobs/{job-id}

# List all jobs
curl http://localhost:3000/api/v1/jobs

# Cancel a job
curl -X DELETE http://localhost:3000/api/v1/jobs/{job-id}
```

### Test the GitHub Metadata API

```bash
# Fetch all metadata
curl "http://localhost:3000/api/v1/github/metadata?owner=facebook&repo=react"

# Fetch specific metadata types
curl "http://localhost:3000/api/v1/github/metadata?owner=facebook&repo=react&include=branches,releases"
```

## Architecture Benefits

### Before: Tight Coupling
```
Frontend ──> Next.js API Routes ──> Business Logic (mixed with HTTP concerns)
```

### After: Clean Separation
```
Frontend ──> Next.js API Routes ─┐
                                  ├──> Core API Layer (pure business logic)
MCP Server ──────────────────────┘
CLI Tools ───────────────────────┘
```

## Key Design Principles

1. **Result Type**: All operations return `Result<T>` for explicit error handling
2. **Pure Functions**: Core API functions are pure and side-effect free
3. **Job-Based Async**: Long-running operations use the job queue
4. **Polling Interface**: Consistent polling pattern across all async operations
5. **Webhook Support**: Optional callbacks for job completion
6. **Framework Agnostic**: Core layer has no Next.js dependencies

## Common Patterns

### Creating a New Endpoint

1. **Add business logic to core API**:
   ```typescript
   // lib/api-core/my-feature/my-operation.ts
   export async function myOperation(input: MyInput): Promise<Result<MyOutput>> {
     try {
       // Business logic here
       return success(output);
     } catch (err) {
       return error('Operation failed');
     }
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
   /my-feature:
     post:
       summary: My operation
       # ... rest of spec
   ```

## Troubleshooting

### Jobs not processing
- Check that the job was created: `GET /api/v1/jobs`
- Check job status: `GET /api/v1/jobs/{id}`
- Check server logs for errors

### Memory growing with jobs
- Call `cleanupJobs()` periodically to remove old completed jobs
- Consider implementing a cron job or scheduled task

### Webhooks not working
- Verify the callback URL is accessible
- Check server logs for webhook errors
- Add HMAC signature validation for security

## Production Considerations

1. **Replace in-memory job store**: Use Redis or PostgreSQL
2. **Add authentication**: Implement API key or JWT auth
3. **Rate limiting**: Add rate limits per API key
4. **Monitoring**: Add metrics and logging (Sentry, DataDog)
5. **Scaling**: Consider horizontal scaling for job workers
6. **Security**: Add HMAC signatures for webhooks
