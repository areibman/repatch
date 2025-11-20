# MCP (Model Context Protocol) Integration Guide

This guide explains how to integrate the Repatch API with Claude Desktop using Stainless MCP.

## What is MCP?

Model Context Protocol (MCP) is a standard for connecting AI assistants like Claude to external data sources and tools. With MCP, Claude can:

- Access your Repatch API directly
- Create patch notes from conversations
- Render videos automatically
- Query GitHub repository data
- Manage subscribers

## Prerequisites

1. **Stainless Account**: Sign up at [stainless.com](https://stainless.com)
2. **Stainless CLI**: Installed via `npm install -g stainless`
3. **Claude Desktop**: [Download here](https://claude.ai/download)
4. **Repatch API Key**: Generate from your Repatch dashboard (coming soon)

## Step 1: Generate MCP Server

The Repatch API includes a complete OpenAPI 3.1 specification (`openapi.yaml`). Use Stainless to generate an MCP server from this spec:

```bash
# Navigate to your project
cd /workspace

# Validate the OpenAPI spec
stainless validate openapi.yaml

# Generate MCP server
stainless generate mcp \
  --spec openapi.yaml \
  --output ./mcp-server \
  --package-name repatch-mcp

# Install dependencies
cd mcp-server
npm install
```

This generates a complete MCP server with:
- Type-safe API client
- Automatic request/response validation
- Built-in error handling
- Full TypeScript support

## Step 2: Configure Claude Desktop

Add the Repatch MCP server to Claude Desktop's configuration:

### macOS
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "repatch": {
      "command": "node",
      "args": [
        "/path/to/your/workspace/mcp-server/dist/index.js"
      ],
      "env": {
        "REPATCH_API_URL": "http://localhost:3000/api/v1",
        "REPATCH_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Windows
Edit `%APPDATA%\Claude\claude_desktop_config.json` with the same configuration.

### Linux
Edit `~/.config/Claude/claude_desktop_config.json` with the same configuration.

## Step 3: Restart Claude Desktop

After saving the configuration:

1. Quit Claude Desktop completely
2. Restart Claude Desktop
3. Check the MCP section in settings to verify the Repatch server is connected

## Step 4: Test Integration

Try these prompts in Claude:

### Fetch GitHub Metadata
```
Can you fetch the branches and releases for facebook/react?
```

Claude will call:
```
GET /api/v1/github/metadata?owner=facebook&repo=react&include=branches,releases
```

### Create a Patch Note Job
```
Create a patch note for the last week of commits in facebook/react
```

Claude will:
1. Create a job: `POST /api/v1/jobs`
2. Poll for completion: `GET /api/v1/jobs/{id}`
3. Show you the result

### Check Job Status
```
What's the status of job job_1234567890_abc?
```

Claude will call:
```
GET /api/v1/jobs/job_1234567890_abc
```

## Available MCP Tools

Once integrated, Claude has access to these tools:

### GitHub Operations
- `getGitHubMetadata` - Fetch branches, labels, releases, tags
- `getGitHubStats` - Get repository statistics
- `summarizeCommits` - AI-powered commit summaries

### Patch Note Operations
- `listPatchNotes` - List all patch notes
- `getPatchNote` - Get a specific patch note
- `createPatchNote` - Create a new patch note
- `updatePatchNote` - Update patch note content
- `deletePatchNote` - Delete a patch note
- `sendPatchNote` - Email patch note to subscribers

### Job Operations
- `createJob` - Start async operations
- `getJobStatus` - Check job progress
- `listJobs` - List all jobs
- `cancelJob` - Cancel a running job

### Template Operations
- `listTemplates` - List AI templates
- `createTemplate` - Create new template
- `updateTemplate` - Update template
- `deleteTemplate` - Delete template

### Subscriber Operations
- `listSubscribers` - List all subscribers
- `createSubscriber` - Add new subscriber
- `updateSubscriber` - Update subscriber status
- `deleteSubscriber` - Remove subscriber

## Example Workflows

### 1. Generate Weekly Patch Note

**Prompt**:
```
Create a patch note for the last week of commits in my repo (owner: myorg, repo: myapp).
Use the "professional" template.
```

**What Claude Does**:
1. Lists available templates to find "professional"
2. Creates a job with `type: 'process-patch-note'`
3. Polls job status until complete
4. Shows you the generated patch note

### 2. Render and Send Newsletter

**Prompt**:
```
Render the video for patch note abc-123 and send it to all subscribers
```

**What Claude Does**:
1. Creates a render-video job
2. Polls until video is complete
3. Calls sendPatchNote to email subscribers
4. Confirms sent count

### 3. Analyze Repository Activity

**Prompt**:
```
Show me stats for facebook/react for the last month, then summarize the top 5 commits
```

**What Claude Does**:
1. Calls getGitHubStats with `timePeriod: '1month'`
2. Calls summarizeCommits with top commits
3. Presents analysis in readable format

## Advanced Configuration

### Custom Base URL

For production deployments:

```json
{
  "mcpServers": {
    "repatch": {
      "env": {
        "REPATCH_API_URL": "https://api.repatch.dev/v1",
        "REPATCH_API_KEY": "prod_key_..."
      }
    }
  }
}
```

### Multiple Environments

Configure separate servers for dev/staging/prod:

```json
{
  "mcpServers": {
    "repatch-dev": {
      "command": "node",
      "args": ["..."],
      "env": {
        "REPATCH_API_URL": "http://localhost:3000/api/v1"
      }
    },
    "repatch-prod": {
      "command": "node",
      "args": ["..."],
      "env": {
        "REPATCH_API_URL": "https://api.repatch.dev/v1",
        "REPATCH_API_KEY": "prod_..."
      }
    }
  }
}
```

### Webhook Configuration

For long-running jobs, configure a webhook endpoint:

```json
{
  "mcpServers": {
    "repatch": {
      "env": {
        "REPATCH_API_URL": "https://api.repatch.dev/v1",
        "REPATCH_API_KEY": "your-key",
        "WEBHOOK_URL": "https://your-app.com/webhooks/repatch"
      }
    }
  }
}
```

Then in your MCP server code, pass the webhook URL when creating jobs:

```typescript
const job = await client.jobs.create({
  type: 'render-video',
  params: { patchNoteId: '123' },
  callbackUrl: process.env.WEBHOOK_URL
});
```

## Polling vs Webhooks

### Polling (Default)
- ✅ Simple to set up
- ✅ Works anywhere
- ❌ Higher latency
- ❌ More API calls

Best for: Development, short jobs (< 1 minute)

### Webhooks
- ✅ Lower latency
- ✅ Fewer API calls
- ❌ Requires public endpoint
- ❌ More complex setup

Best for: Production, long jobs (> 1 minute)

## Troubleshooting

### MCP Server Not Connecting

1. **Check logs**: Claude Desktop → Settings → MCP → View Logs
2. **Verify path**: Make sure the path to `index.js` is correct
3. **Test manually**: 
   ```bash
   node /path/to/mcp-server/dist/index.js
   ```
4. **Check permissions**: Ensure the file is executable

### Authentication Errors

1. **Verify API key**: Check that `REPATCH_API_KEY` is set correctly
2. **Check expiration**: API keys may expire (coming soon)
3. **Test API**: Try calling API directly with curl:
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" \
     http://localhost:3000/api/v1/jobs
   ```

### Jobs Stuck in "Processing"

1. **Check server logs**: Look for errors in the API server
2. **Inspect job**: Call `GET /api/v1/jobs/{id}` directly
3. **Check timeout**: Some jobs have max durations (see `openapi.yaml`)
4. **Restart server**: As a last resort, restart the Next.js server

### Missing Tools in Claude

1. **Refresh**: Restart Claude Desktop
2. **Rebuild MCP server**: Re-run `stainless generate`
3. **Verify OpenAPI spec**: Run `stainless validate openapi.yaml`
4. **Check version**: Make sure Claude Desktop is up to date

## Security Best Practices

1. **Never commit API keys**: Keep them in environment variables
2. **Use HMAC signatures**: For webhook validation (coming soon)
3. **Rotate keys regularly**: Generate new keys periodically
4. **Limit permissions**: Use separate keys for different environments
5. **Monitor usage**: Track API calls and set up alerts

## Performance Optimization

1. **Cache metadata**: GitHub metadata changes rarely
2. **Batch requests**: Use unified endpoints (e.g., `getGitHubMetadata`)
3. **Use webhooks**: Avoid polling for long jobs
4. **Set timeouts**: Don't let jobs run indefinitely
5. **Clean up old jobs**: Periodically remove completed jobs

## Next Steps

- [ ] Deploy MCP server to production
- [ ] Set up webhook endpoint for async jobs
- [ ] Create custom templates for your use cases
- [ ] Integrate with CI/CD pipeline
- [ ] Build custom MCP tools for your workflow

## Resources

- [MCP Specification](https://modelcontextprotocol.io)
- [Stainless Documentation](https://stainless.com/docs)
- [Claude Desktop](https://claude.ai/download)
- [OpenAPI 3.1 Spec](https://spec.openapis.org/oas/v3.1.0)
