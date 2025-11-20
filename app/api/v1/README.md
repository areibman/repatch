# Repatch API v1

Version 1 of the Repatch API - designed for MCP (Model Context Protocol) integration and multi-client access.

## Overview

This is a versioned, framework-agnostic API layer that provides:
- ✅ Clean separation from Next.js frontend
- ✅ Unified endpoints for common operations
- ✅ Job-based async operations with polling
- ✅ OpenAPI 3.1 specification
- ✅ Ready for MCP server generation via Stainless

## Base URL

```
Production: https://api.repatch.dev/v1
Development: http://localhost:3000/api/v1
```

## Authentication

Coming soon: Bearer token authentication

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.repatch.dev/v1/jobs
```

## Endpoints

### GitHub Metadata
`GET /github/metadata` - Unified endpoint for repository metadata

**Query Parameters**:
- `owner` (required) - Repository owner
- `repo` (required) - Repository name  
- `include` (optional) - Comma-separated list: `branches,labels,releases,tags`

**Example**:
```bash
curl "http://localhost:3000/api/v1/github/metadata?owner=facebook&repo=react&include=branches,releases"
```

### Jobs

#### Create Job
`POST /jobs` - Create an async job

**Body**:
```json
{
  "type": "render-video",
  "params": {
    "patchNoteId": "123"
  },
  "callbackUrl": "https://myapp.com/webhook"
}
```

**Response** (201):
```json
{
  "id": "job_1234567890_abc",
  "type": "render-video",
  "status": "queued",
  "progress": 0,
  "params": { "patchNoteId": "123" },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Get Job Status
`GET /jobs/{id}` - Poll for job status

**Response**:
```json
{
  "id": "job_1234567890_abc",
  "type": "render-video",
  "status": "completed",
  "progress": 100,
  "result": {
    "videoUrl": "https://...",
    "renderId": "..."
  },
  "completedAt": "2024-01-01T00:05:00.000Z"
}
```

**Status Values**:
- `queued` - Job is waiting to be processed
- `processing` - Job is currently running
- `completed` - Job finished successfully
- `failed` - Job encountered an error
- `cancelled` - Job was cancelled

#### List Jobs
`GET /jobs` - List all jobs

**Query Parameters**:
- `type` (optional) - Filter by job type
- `status` (optional) - Filter by status

**Example**:
```bash
curl "http://localhost:3000/api/v1/jobs?status=completed"
```

#### Cancel Job
`DELETE /jobs/{id}` - Cancel a running job

## Job Types

### `process-patch-note`
Generate patch note content from GitHub data

**Params**:
```json
{
  "patchNoteId": "uuid",
  "owner": "facebook",
  "repo": "react",
  "repoUrl": "https://github.com/facebook/react",
  "branch": "main",
  "filters": {
    "mode": "preset",
    "preset": "1week"
  },
  "templateId": "uuid"
}
```

### `render-video`
Render a video using Remotion Lambda

**Params**:
```json
{
  "patchNoteId": "uuid"
}
```

### `generate-video-top-changes`
Extract top 3 changes from content using AI

**Params**:
```json
{
  "content": "# Release Notes\n...",
  "repoName": "my-repo"
}
```

## Polling Pattern

For long-running operations:

1. **Create the job**: `POST /jobs`
2. **Poll for status**: `GET /jobs/{id}` every 5-10 seconds
3. **Check status**: Continue until `status === 'completed'` or `'failed'`
4. **Get result**: Extract from `result` field when complete

**Example**:
```typescript
async function waitForJob(jobId: string) {
  while (true) {
    const response = await fetch(`/api/v1/jobs/${jobId}`);
    const job = await response.json();
    
    if (job.status === 'completed') {
      return job.result;
    }
    
    if (job.status === 'failed') {
      throw new Error(job.error);
    }
    
    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
```

## Webhooks

Optionally provide a `callbackUrl` when creating a job. The server will POST to this URL when the job completes:

**Webhook Payload**:
```json
{
  "jobId": "job_1234567890_abc",
  "type": "render-video",
  "status": "completed",
  "result": { ... },
  "completedAt": "2024-01-01T00:05:00.000Z"
}
```

## Error Handling

All errors return JSON with an `error` field:

```json
{
  "error": "Job not found"
}
```

**Status Codes**:
- `200` - Success
- `201` - Created
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (coming soon)
- `404` - Not found
- `500` - Internal server error

## Rate Limiting

Coming soon: Rate limits per API key

## OpenAPI Specification

Full OpenAPI 3.1 spec available at `/openapi.yaml`

Use with:
- Postman
- Swagger UI
- Stainless (MCP generation)
- OpenAPI generators

## MCP Integration

This API is designed for Model Context Protocol (MCP) integration:

1. **Generate MCP server** using Stainless:
   ```bash
   stainless generate mcp --spec openapi.yaml
   ```

2. **Configure in Claude Desktop**:
   ```json
   {
     "mcpServers": {
       "repatch": {
         "command": "node",
         "args": ["path/to/mcp-server/dist/index.js"],
         "env": {
           "API_KEY": "your-api-key"
         }
       }
     }
   }
   ```

3. **Use in Claude**: AI can now call Repatch API directly!

## Examples

See `docs/IMPLEMENTATION_GUIDE.md` for more examples and patterns.

## Support

- Documentation: `/docs`
- OpenAPI Spec: `/openapi.yaml`
- Issues: GitHub Issues
