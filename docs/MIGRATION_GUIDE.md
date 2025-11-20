# Migration Guide: Legacy API → V1 API

This guide helps you migrate from the existing API endpoints to the new v1 API.

## Overview

The v1 API provides:
- ✅ Cleaner architecture
- ✅ Unified endpoints
- ✅ Job-based async operations
- ✅ Better error handling
- ✅ MCP compatibility

## Migration Strategy

### Phase 1: Parallel Operation (Recommended)
Keep both APIs running simultaneously:
- Old API continues serving existing frontend
- New v1 API available for new integrations
- Migrate frontend gradually
- Deprecate old API once migration complete

### Phase 2: Complete Migration
Once all clients use v1:
- Remove old API routes
- Clean up unused code
- Update documentation

## Endpoint Mapping

### GitHub Endpoints

#### Branches
**Before**:
```typescript
GET /api/github/branches?owner=X&repo=Y
```

**After**:
```typescript
GET /api/v1/github/metadata?owner=X&repo=Y&include=branches
```

**Benefits**: Can fetch multiple types in one request

---

#### Labels
**Before**:
```typescript
GET /api/github/labels?owner=X&repo=Y
```

**After**:
```typescript
GET /api/v1/github/metadata?owner=X&repo=Y&include=labels
```

---

#### Releases
**Before**:
```typescript
GET /api/github/releases?owner=X&repo=Y
```

**After**:
```typescript
GET /api/v1/github/metadata?owner=X&repo=Y&include=releases
```

---

#### Tags
**Before**:
```typescript
GET /api/github/tags?owner=X&repo=Y
```

**After**:
```typescript
GET /api/v1/github/metadata?owner=X&repo=Y&include=tags
```

---

#### Stats
**Before**:
```typescript
GET /api/github/stats?owner=X&repo=Y&timePeriod=1week
POST /api/github/stats { owner, repo, filters }
```

**After**: (Coming soon in v1)
```typescript
// Will remain similar but use core API layer
GET /api/v1/github/stats?owner=X&repo=Y&timePeriod=1week
POST /api/v1/github/stats { owner, repo, filters }
```

---

### Patch Note Endpoints

#### List Patch Notes
**Before**:
```typescript
GET /api/patch-notes
```

**After**: (Coming soon in v1)
```typescript
GET /api/v1/patch-notes
```

---

#### Create Patch Note
**Before**:
```typescript
POST /api/patch-notes { repo_name, title, content, ... }
```

**After**: (Coming soon in v1)
```typescript
POST /api/v1/patch-notes { repo_name, title, content, ... }
```

---

#### Process Patch Note
**Before**:
```typescript
POST /api/patch-notes/[id]/process { owner, repo, filters, ... }
```

**After**:
```typescript
// Use job-based approach
POST /api/v1/jobs {
  type: 'process-patch-note',
  params: {
    patchNoteId: id,
    owner,
    repo,
    repoUrl,
    branch,
    filters,
    templateId
  }
}

// Then poll for status
GET /api/v1/jobs/[jobId]
```

**Benefits**:
- Unified polling interface
- Better progress tracking
- Webhook support
- Easier debugging

---

#### Render Video
**Before**:
```typescript
POST /api/patch-notes/[id]/render-video
GET /api/patch-notes/[id]/video-status  // Poll every 5s
```

**After**:
```typescript
// Create job
POST /api/v1/jobs {
  type: 'render-video',
  params: { patchNoteId: id }
}

// Poll job status
GET /api/v1/jobs/[jobId]
```

**Benefits**:
- Consistent polling pattern
- Server-side Lambda polling
- Webhook notifications
- Better error handling

---

#### Generate Video Top Changes
**Before**:
```typescript
POST /api/patch-notes/generate-video-top3 {
  content,
  repoName
}
```

**After**:
```typescript
POST /api/v1/jobs {
  type: 'generate-video-top-changes',
  params: { content, repoName }
}

// Poll for result
GET /api/v1/jobs/[jobId]
```

---

### Templates Endpoints

**Before & After**: (No changes needed, but v1 versions coming)
```typescript
GET /api/ai-templates          → GET /api/v1/templates
POST /api/ai-templates         → POST /api/v1/templates
PUT /api/ai-templates/[id]     → PUT /api/v1/templates/[id]
DELETE /api/ai-templates/[id]  → DELETE /api/v1/templates/[id]
```

---

### Subscribers Endpoints

**Before & After**: (No changes needed, but v1 versions coming)
```typescript
GET /api/subscribers           → GET /api/v1/subscribers
POST /api/subscribers          → POST /api/v1/subscribers
PUT /api/subscribers           → PUT /api/v1/subscribers/[id]
DELETE /api/subscribers        → DELETE /api/v1/subscribers/[id]
```

---

## Code Examples

### Example 1: Fetch Multiple GitHub Metadata Types

**Before** (3 requests):
```typescript
const [branches, labels, releases] = await Promise.all([
  fetch('/api/github/branches?owner=X&repo=Y'),
  fetch('/api/github/labels?owner=X&repo=Y'),
  fetch('/api/github/releases?owner=X&repo=Y'),
]);
```

**After** (1 request):
```typescript
const metadata = await fetch(
  '/api/v1/github/metadata?owner=X&repo=Y&include=branches,labels,releases'
);
// { branches: [...], labels: [...], releases: [...] }
```

---

### Example 2: Render Video with Polling

**Before**:
```typescript
// Start render
await fetch(`/api/patch-notes/${id}/render-video`, {
  method: 'POST'
});

// Poll video status
const pollStatus = async () => {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/patch-notes/${id}/video-status`);
    const data = await res.json();
    
    if (data.status === 'completed') {
      clearInterval(interval);
      console.log('Video URL:', data.videoUrl);
    }
    
    if (data.status === 'failed') {
      clearInterval(interval);
      console.error('Video failed:', data.error);
    }
  }, 5000);
};

pollStatus();
```

**After**:
```typescript
// Create job
const jobRes = await fetch('/api/v1/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'render-video',
    params: { patchNoteId: id },
    callbackUrl: 'https://myapp.com/webhook' // Optional
  })
});

const job = await jobRes.json();

// Poll job status (unified interface)
const pollStatus = async () => {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/v1/jobs/${job.id}`);
    const data = await res.json();
    
    console.log(`Progress: ${data.progress}%`);
    
    if (data.status === 'completed') {
      clearInterval(interval);
      console.log('Video URL:', data.result.videoUrl);
    }
    
    if (data.status === 'failed') {
      clearInterval(interval);
      console.error('Job failed:', data.error);
    }
  }, 5000);
};

pollStatus();
```

**Benefits**:
- Progress tracking (0-100%)
- Unified polling for all jobs
- Optional webhooks (no polling needed)
- Better error messages

---

### Example 3: React Hook for Job Polling

**Before**:
```typescript
function useVideoRenderStatus(patchNoteId: string) {
  const [status, setStatus] = useState<VideoStatus>();
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(
        `/api/patch-notes/${patchNoteId}/video-status`
      );
      const data = await res.json();
      setStatus(data);
      
      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(interval);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [patchNoteId]);
  
  return status;
}
```

**After**:
```typescript
function useJob<T>(jobId: string) {
  const [job, setJob] = useState<Job<T>>();
  
  useEffect(() => {
    if (!jobId) return;
    
    const interval = setInterval(async () => {
      const res = await fetch(`/api/v1/jobs/${jobId}`);
      const data = await res.json();
      setJob(data);
      
      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(interval);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [jobId]);
  
  return job;
}

// Usage: works for ANY job type
const videoJob = useJob<RenderVideoResult>(videoJobId);
const processJob = useJob<ProcessPatchNoteResult>(processJobId);
```

**Benefits**:
- Single hook for all job types
- Type-safe results
- Reusable across features

---

## Breaking Changes

### 1. Job-Based Async Operations

All long-running operations now use jobs:
- `POST /api/v1/jobs` instead of specific endpoints
- Unified polling via `GET /api/v1/jobs/[id]`
- Consistent status values
- Progress tracking (0-100%)

**Migration**:
1. Replace endpoint-specific calls with job creation
2. Update polling logic to use `/api/v1/jobs/[id]`
3. Handle job lifecycle: queued → processing → completed/failed

### 2. Unified Metadata Endpoint

Multiple GitHub endpoints combined:
- `include` parameter controls what's fetched
- Single request can fetch multiple types
- Parallel fetching on server side

**Migration**:
1. Identify places fetching multiple metadata types
2. Replace with single `getGitHubMetadata` call
3. Parse `include` parameter from comma-separated string

### 3. Result Types

Core API returns `Result<T>`:
```typescript
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string };
```

**Migration**:
If calling core API directly:
```typescript
// Before
try {
  const data = await someFunction();
  // use data
} catch (error) {
  // handle error
}

// After
const result = await someFunction();
if (result.success) {
  // use result.data
} else {
  // handle result.error
}
```

---

## Testing Your Migration

### 1. Run Existing Tests
```bash
bun run test:api
```

### 2. Test Old Endpoints
Ensure old endpoints still work:
```bash
curl http://localhost:3000/api/github/branches?owner=facebook&repo=react
```

### 3. Test New Endpoints
Verify v1 endpoints work:
```bash
curl "http://localhost:3000/api/v1/github/metadata?owner=facebook&repo=react&include=branches"
```

### 4. Test Job Lifecycle
```bash
# Create job
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"type":"generate-video-top-changes","params":{"content":"...","repoName":"test"}}'

# Poll status
curl http://localhost:3000/api/v1/jobs/{job-id}
```

---

## Rollback Plan

If issues arise:

### 1. Revert API Changes
```bash
git revert {commit-hash}
```

### 2. Keep Both APIs
The old API continues working:
- Frontend can use old endpoints
- New integrations can use v1
- No breaking changes

### 3. Feature Flag
Use feature flag to toggle v1 API:
```typescript
const USE_V1_API = process.env.NEXT_PUBLIC_USE_V1_API === 'true';

const endpoint = USE_V1_API 
  ? '/api/v1/jobs'
  : '/api/patch-notes/${id}/render-video';
```

---

## Timeline

### Week 1: Preparation
- [ ] Review this migration guide
- [ ] Identify all API usage in frontend
- [ ] Create migration checklist
- [ ] Set up feature flags (optional)

### Week 2-3: Gradual Migration
- [ ] Migrate GitHub metadata calls
- [ ] Migrate video rendering to jobs
- [ ] Migrate patch note processing to jobs
- [ ] Update polling logic

### Week 4: Testing & Validation
- [ ] Test all migrated features
- [ ] Performance testing
- [ ] Load testing
- [ ] User acceptance testing

### Week 5: Deprecation
- [ ] Mark old endpoints as deprecated
- [ ] Add deprecation warnings in logs
- [ ] Update documentation
- [ ] Notify users (if external API)

### Week 6+: Cleanup
- [ ] Remove old API routes
- [ ] Clean up unused code
- [ ] Update tests
- [ ] Final documentation update

---

## Support

If you encounter issues:

1. **Check documentation**:
   - `docs/API_ARCHITECTURE.md`
   - `docs/IMPLEMENTATION_GUIDE.md`
   - `app/api/v1/README.md`

2. **Review examples**:
   - `scripts/test-api-v1.ts`

3. **Debug**:
   - Check server logs
   - Inspect API responses
   - Use browser DevTools

4. **Get help**:
   - GitHub Issues
   - Internal Slack channel
   - Email: support@repatch.dev

---

## FAQ

### Q: Do I need to migrate all at once?
**A**: No! Both APIs can run in parallel. Migrate gradually.

### Q: Will old endpoints stop working?
**A**: No, old endpoints continue working until explicitly removed.

### Q: What about external API users?
**A**: Give them 6-12 months notice before deprecating old API.

### Q: Can I use both APIs in the same app?
**A**: Yes! Use feature flags or gradual rollout.

### Q: What if v1 has a bug?
**A**: Rollback to old API or fix bug in v1. No breaking changes to old API.

### Q: How do I know migration is complete?
**A**: When all old API endpoints show 0 usage in logs/metrics.

---

## Checklist

Use this checklist to track your migration:

### GitHub Endpoints
- [ ] Replace `/api/github/branches` with unified metadata
- [ ] Replace `/api/github/labels` with unified metadata
- [ ] Replace `/api/github/releases` with unified metadata
- [ ] Replace `/api/github/tags` with unified metadata
- [ ] Combine multiple metadata calls into single requests

### Async Operations
- [ ] Migrate video rendering to job-based
- [ ] Migrate patch note processing to job-based
- [ ] Migrate video top changes generation to job-based
- [ ] Update polling logic to use `/api/v1/jobs/[id]`
- [ ] Add webhook support (optional)

### Frontend Components
- [ ] Update API client/service layer
- [ ] Update React hooks (useVideoStatus, etc.)
- [ ] Update error handling
- [ ] Update loading states
- [ ] Update progress indicators

### Testing
- [ ] Test GitHub metadata endpoints
- [ ] Test job creation
- [ ] Test job polling
- [ ] Test error cases
- [ ] Test edge cases
- [ ] Load testing

### Documentation
- [ ] Update API documentation
- [ ] Update frontend README
- [ ] Update deployment docs
- [ ] Add migration notes to changelog

### Cleanup
- [ ] Remove old API routes
- [ ] Remove unused code
- [ ] Remove feature flags
- [ ] Update dependencies
- [ ] Archive migration docs
