# Stainless Integration Guide

## Overview
This guide explains how to use Stainless to generate an MCP (Model Context Protocol) server from our OpenAPI specification.

## Prerequisites

1. **Stainless CLI**: Install globally
   ```bash
   npm install -g stainless-cli
   ```

2. **API Key**: Set in environment
   ```bash
   export STAINLESS_API_KEY="your-api-key"
   ```

## Step 1: Validate OpenAPI Spec

Ensure the OpenAPI spec is valid:

```bash
stainless validate openapi.yaml
```

## Step 2: Generate TypeScript SDK

Generate a type-safe SDK for frontend usage:

```bash
stainless generate \
  --openapi openapi.yaml \
  --output ./sdk \
  --language typescript \
  --package-name @repatch/sdk
```

This creates:
- `./sdk/src/` - TypeScript SDK source
- `./sdk/package.json` - NPM package config
- `./sdk/README.md` - SDK documentation

### Using the SDK

```typescript
import { RepatchClient } from '@repatch/sdk';

const client = new RepatchClient({
  apiKey: process.env.REPATCH_API_KEY,
  baseUrl: 'https://api.repatch.com/v1',
});

// List branches
const branches = await client.github.repositories.branches.list({
  owner: 'facebook',
  repo: 'react',
});

// Create patch note
const patchNote = await client.patchNotes.create({
  repo_name: 'facebook/react',
  repo_url: 'https://github.com/facebook/react',
  title: 'Release Notes',
  content: '...',
});

// Start video render job
const job = await client.patchNotes.jobs.renderVideo(patchNote.id);

// Poll job status
while (job.status !== 'completed') {
  await new Promise(resolve => setTimeout(resolve, 5000));
  job = await client.jobs.get(job.id);
  console.log(`Progress: ${job.progress}%`);
}
```

## Step 3: Generate MCP Server

Generate an MCP server that wraps the API:

```bash
stainless mcp generate \
  --openapi openapi.yaml \
  --output ./mcp-server \
  --server-name repatch
```

This creates:
- `./mcp-server/src/` - MCP server source
- `./mcp-server/package.json` - Server package
- `./mcp-server/config.yaml` - MCP configuration

### MCP Server Structure

```
mcp-server/
├── src/
│   ├── index.ts          # Server entry point
│   ├── resources.ts      # MCP resources
│   ├── tools.ts          # MCP tools
│   └── prompts.ts        # MCP prompts
├── package.json
├── config.yaml           # MCP config
└── README.md
```

## Step 4: Configure MCP Server

Edit `./mcp-server/config.yaml`:

```yaml
name: repatch
version: 1.0.0
description: GitHub patch note generation and video rendering

# Server configuration
server:
  port: 3001
  host: localhost

# Authentication
auth:
  type: apiKey
  header: X-API-Key

# Base URL for API
api:
  baseUrl: https://api.repatch.com/v1

# MCP resources
resources:
  - name: patch-notes
    description: Repository patch notes
    schema:
      type: object
      properties:
        id: { type: string }
        title: { type: string }
        content: { type: string }
        video_url: { type: string }
  
  - name: github-repositories
    description: GitHub repository metadata
    schema:
      type: object
      properties:
        owner: { type: string }
        repo: { type: string }

# MCP tools
tools:
  - name: create_patch_note
    description: Create a new patch note
    inputSchema:
      type: object
      required: [repo_name, repo_url, title, content]
  
  - name: render_video
    description: Start video render for patch note
    inputSchema:
      type: object
      required: [patch_note_id]
  
  - name: poll_job
    description: Check job status
    inputSchema:
      type: object
      required: [job_id]

# Polling configuration for long-running operations
polling:
  - endpoint: /jobs/{jobId}
    interval: 5000  # 5 seconds
    timeout: 300000  # 5 minutes
    statusField: status
    completeValues: [completed]
    failedValues: [failed, cancelled]
    progressField: progress
```

## Step 5: Run MCP Server Locally

```bash
cd mcp-server
npm install
npm run dev
```

Server will be available at `http://localhost:3001`

## Step 6: Test with MCP Inspector

Use Stainless MCP Inspector to test:

```bash
stainless mcp inspect --url http://localhost:3001
```

This opens a web UI to:
- List available resources
- Test tools/functions
- Inspect schemas
- Debug requests

## Step 7: Connect to Claude/GPT

### For Claude Desktop

Add to `~/Library/Application Support/Claude/config.json`:

```json
{
  "mcpServers": {
    "repatch": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "REPATCH_API_KEY": "your-api-key"
      }
    }
  }
}
```

Restart Claude Desktop, then use:

```
Claude: Can you create a patch note for facebook/react?
[MCP] Calling create_patch_note...
[MCP] ✓ Patch note created
[MCP] Starting video render...
[MCP] Polling job status...
[MCP] ✓ Video complete: https://...
```

### For Custom LLM Integration

```typescript
import { MCPClient } from '@modelcontextprotocol/sdk';

const mcp = new MCPClient({
  serverUrl: 'http://localhost:3001',
  apiKey: process.env.REPATCH_API_KEY,
});

// List available tools
const tools = await mcp.listTools();

// Call tool
const result = await mcp.callTool('create_patch_note', {
  repo_name: 'facebook/react',
  repo_url: 'https://github.com/facebook/react',
  title: 'v18.3.0 Release Notes',
  content: '...',
});

// Poll job
const job = await mcp.callTool('poll_job', {
  job_id: result.jobId,
});
```

## Step 8: Deploy MCP Server

### Option 1: Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY mcp-server/package*.json ./
RUN npm ci --production
COPY mcp-server/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

```bash
docker build -t repatch-mcp .
docker run -p 3001:3001 \
  -e REPATCH_API_KEY=$REPATCH_API_KEY \
  repatch-mcp
```

### Option 2: Railway/Render

Deploy `./mcp-server` as Node.js service:
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: `REPATCH_API_KEY`

### Option 3: AWS Lambda

```bash
cd mcp-server
npm run build
zip -r mcp-server.zip dist node_modules package.json

aws lambda create-function \
  --function-name repatch-mcp \
  --runtime nodejs20.x \
  --handler dist/index.handler \
  --zip-file fileb://mcp-server.zip \
  --role arn:aws:iam::ACCOUNT:role/lambda-role \
  --environment Variables={REPATCH_API_KEY=$REPATCH_API_KEY}
```

## Advanced Features

### Streaming Support

For long-running operations, MCP supports streaming:

```typescript
// In MCP server
export async function* streamJobProgress(jobId: string) {
  let job = await getJob(jobId);
  
  while (job.status === 'running') {
    yield {
      type: 'progress',
      progress: job.progress,
      message: `Processing: ${job.progress}%`,
    };
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    job = await getJob(jobId);
  }
  
  yield {
    type: 'complete',
    result: job.result,
  };
}
```

### Resource Subscriptions

Subscribe to resource changes:

```typescript
// LLM can subscribe to patch note updates
const subscription = await mcp.subscribe('patch-notes', {
  filter: { repo_name: 'facebook/react' },
});

subscription.on('created', (patchNote) => {
  console.log('New patch note:', patchNote.title);
});

subscription.on('updated', (patchNote) => {
  console.log('Video ready:', patchNote.video_url);
});
```

### Batch Operations

MCP can batch multiple operations:

```typescript
const results = await mcp.batch([
  { tool: 'create_patch_note', params: {...} },
  { tool: 'create_patch_note', params: {...} },
  { tool: 'create_patch_note', params: {...} },
]);
```

## Monitoring & Debugging

### MCP Server Logs

```bash
# Enable debug logging
DEBUG=mcp:* npm run dev

# View request logs
tail -f mcp-server.log
```

### Metrics

Add OpenTelemetry:

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('repatch-mcp');

export async function createPatchNote(params: any) {
  const span = tracer.startSpan('create_patch_note');
  try {
    const result = await api.patchNotes.create(params);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
```

## Best Practices

1. **Polling Strategy**: Use exponential backoff for job polling
2. **Error Handling**: Provide clear error messages for LLMs
3. **Rate Limiting**: Implement rate limits per MCP client
4. **Caching**: Cache frequently accessed resources
5. **Versioning**: Version your MCP schema for compatibility

## Troubleshooting

### Issue: MCP server not connecting

**Solution**: Check server is running and firewall allows port 3001

```bash
netstat -an | grep 3001
curl http://localhost:3001/health
```

### Issue: LLM not seeing tools

**Solution**: Verify MCP config and restart LLM client

```bash
stainless mcp validate config.yaml
cat ~/Library/Application\ Support/Claude/config.json
```

### Issue: Job polling timing out

**Solution**: Increase timeout in config.yaml

```yaml
polling:
  timeout: 600000  # 10 minutes
```

## Resources

- [Stainless Documentation](https://stainless.com/docs)
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [OpenAPI 3.1 Spec](https://spec.openapis.org/oas/v3.1.0)
- [Repatch API Docs](https://api.repatch.com/docs)
