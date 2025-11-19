# API v1 Migration Guide

## Overview

The new v1 API provides a cleaner, more RESTful interface with job-based async operations. This guide helps you migrate from the old API to v1.

## What's New in v1

### 1. **Resource-Based URLs**
Old: `/api/github/branches?owner=facebook&repo=react`  
New: `/api/v1/github/repositories/facebook/react/branches`

### 2. **Job-Based Async Operations**
Old: Direct polling of patch note video status  
New: Universal job system with progress tracking

### 3. **Unified Error Responses**
All errors return consistent format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### 4. **Better Status Codes**
- `202 Accepted` for async operations (returns job ID)
- `409 Conflict` for duplicate resources
- `429 Too Many Requests` for rate limits

## Migration Examples

### GitHub APIs

#### Branches
```typescript
// OLD
const res = await fetch('/api/github/branches?owner=facebook&repo=react');

// NEW
const res = await fetch('/api/v1/github/repositories/facebook/react/branches');
```

#### Stats
```typescript
// OLD (GET with query params)
const res = await fetch('/api/github/stats?owner=facebook&repo=react&timePeriod=1week');

// NEW (POST with body)
const res = await fetch('/api/v1/github/repositories/facebook/react/stats', {
  method: 'POST',
  body: JSON.stringify({
    branch: 'main',
    filters: {
      mode: 'preset',
      preset: '1week',
    },
  }),
});
```

### Patch Notes

#### List
```typescript
// OLD
const res = await fetch('/api/patch-notes');

// NEW (with pagination)
const res = await fetch('/api/v1/patch-notes?limit=20&offset=0');
```

#### Process (with job polling)
```typescript
// OLD (5min timeout, blocks UI)
const res = await fetch('/api/patch-notes/123/process', {
  method: 'POST',
  body: JSON.stringify({ owner, repo, repoUrl, filters }),
});
const result = await res.json();

// NEW (returns immediately, poll for result)
const res = await fetch('/api/v1/patch-notes/123/jobs/process', {
  method: 'POST',
  body: JSON.stringify({ owner, repo, repoUrl, filters }),
});
const { jobId, pollUrl } = await res.json();

// Poll job status
async function pollJob(jobId: string) {
  while (true) {
    const jobRes = await fetch(`/api/v1/jobs/${jobId}`);
    const job = await jobRes.json();
    
    console.log(`Progress: ${job.progress}%`);
    
    if (job.status === 'completed') {
      return job.result;
    }
    
    if (job.status === 'failed') {
      throw new Error(job.error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

const result = await pollJob(jobId);
```

#### Video Rendering
```typescript
// OLD
const res = await fetch('/api/patch-notes/123/render-video', {
  method: 'POST',
});
const { renderId } = await res.json();

// Poll separately
const statusRes = await fetch('/api/patch-notes/123/video-status');
const { status, progress } = await statusRes.json();

// NEW (unified job system)
const res = await fetch('/api/v1/patch-notes/123/jobs/render-video', {
  method: 'POST',
});
const { jobId } = await res.json();

// Poll job (same as processing)
const result = await pollJob(jobId);
console.log('Video URL:', result.videoUrl);
```

## React Hook Example

Create a reusable hook for job polling:

```typescript
import { useState, useEffect } from 'react';

interface Job {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result?: any;
  error?: string;
}

export function useJob(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    setLoading(true);

    async function poll() {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/v1/jobs/${jobId}`);
          if (!res.ok) throw new Error('Failed to fetch job');
          
          const data = await res.json();
          setJob(data);

          if (data.status === 'completed' || data.status === 'failed') {
            setLoading(false);
            if (data.status === 'failed') {
              setError(data.error);
            }
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
          break;
        }
      }
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return { job, loading, error };
}

// Usage
function VideoRenderer({ patchNoteId }: { patchNoteId: string }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const { job, loading, error } = useJob(jobId);

  async function startRender() {
    const res = await fetch(`/api/v1/patch-notes/${patchNoteId}/jobs/render-video`, {
      method: 'POST',
    });
    const { jobId } = await res.json();
    setJobId(jobId);
  }

  return (
    <div>
      <button onClick={startRender}>Render Video</button>
      
      {loading && (
        <div>
          <p>Rendering: {job?.progress}%</p>
          <progress value={job?.progress} max={100} />
        </div>
      )}
      
      {job?.status === 'completed' && (
        <video src={job.result.videoUrl} controls />
      )}
      
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

## Backward Compatibility

The old API endpoints remain active for now, but will be removed in 3 months (2025-04-19).

### Deprecation Warnings

Old endpoints return a deprecation header:

```http
X-API-Deprecation: true
X-API-Sunset: 2025-04-19
X-API-Migration: https://docs.repatch.com/api/v1/migration
```

## Testing Both APIs

Use environment variable to switch:

```typescript
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';

const API_BASE = API_VERSION === 'v1' 
  ? '/api/v1'
  : '/api';

// Usage
fetch(`${API_BASE}/patch-notes`);
```

## Breaking Changes

### 1. Response Format Changes

#### Patch Notes
Old: Uses database column names (`repo_name`, `video_url`)  
New: Same format (no change)

#### Jobs
Old: No job system  
New: All async operations return job objects

### 2. Status Codes

Old: Returns 200 for async operations  
New: Returns 202 with job ID

### 3. Error Format

Old: `{ error: "message" }`  
New: `{ error: "message", code: "CODE", details: {} }`

## FAQ

### Q: Do I need to migrate immediately?

No, old endpoints work for 3 months. Migrate at your convenience.

### Q: Will job polling increase API calls?

Yes, but you can use longer intervals (5-10s) for most jobs. Video rendering provides progress updates.

### Q: Can I cancel jobs?

Yes, use `POST /api/v1/jobs/{jobId}/cancel`

### Q: How do I handle job failures?

Jobs have `error` field with detailed message. You can retry by creating a new job.

### Q: Are there rate limits?

Not yet, but will be added:
- 100 requests/minute per IP
- 10 concurrent jobs per user

## Need Help?

- [API Documentation](https://docs.repatch.com/api/v1)
- [OpenAPI Spec](https://api.repatch.com/openapi.yaml)
- [GitHub Issues](https://github.com/repatch/issues)
- [Discord Community](https://discord.gg/repatch)
