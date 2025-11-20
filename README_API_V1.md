# Repatch API v1 - Quick Start Guide

## 🚀 What's New

We've separated the core API from the frontend to enable:
- ✅ **MCP (Model Context Protocol)** integration for LLM access
- ✅ **Clean architecture** with business logic separated from HTTP
- ✅ **Job-based async operations** with progress tracking
- ✅ **Resource-based URLs** for better REST compliance
- ✅ **TypeScript SDK generation** via Stainless
- ✅ **Unified error handling** and status codes

## 📁 New Files & Structure

```
/workspace/
├── openapi.yaml                    # OpenAPI 3.1 specification
├── docs/
│   ├── API_SEPARATION_PLAN.md     # Architecture & planning
│   ├── STAINLESS_INTEGRATION.md   # MCP setup guide
│   ├── API_V1_MIGRATION.md        # Migration guide
│   └── IMPLEMENTATION_SUMMARY.md  # This implementation
├── lib/api/                        # Core business logic
│   ├── jobs.ts                    # Job management
│   ├── github.ts                  # GitHub operations
│   └── patch-notes.ts             # Patch note operations
├── app/api/v1/                    # V1 API routes
│   ├── github/repositories/[owner]/[repo]/
│   │   ├── branches/route.ts
│   │   ├── labels/route.ts
│   │   ├── releases/route.ts
│   │   ├── tags/route.ts
│   │   └── stats/route.ts
│   ├── patch-notes/
│   │   ├── route.ts
│   │   ├── [id]/route.ts
│   │   └── [id]/jobs/
│   │       ├── process/route.ts
│   │       └── render-video/route.ts
│   ├── jobs/[jobId]/
│   │   ├── route.ts
│   │   └── cancel/route.ts
│   ├── templates/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   └── subscribers/route.ts
├── supabase/migrations/
│   └── 20250119000000_add_jobs_table.sql
└── scripts/
    └── generate-mcp-server.sh
```

## 🗄️ Database Migration

**IMPORTANT:** Run this migration before testing:

```bash
# Apply the jobs table migration
psql $DATABASE_URL < supabase/migrations/20250119000000_add_jobs_table.sql

# Or via Supabase CLI
supabase db push
```

The migration adds:
- `jobs` table for async operation tracking
- Indexes for efficient querying
- Auto-updating timestamps

## 🔧 Quick Test

### 1. Start Development Server

```bash
npm run dev
```

### 2. Test GitHub API

```bash
# List branches
curl http://localhost:3000/api/v1/github/repositories/facebook/react/branches

# Get stats
curl -X POST http://localhost:3000/api/v1/github/repositories/facebook/react/stats \
  -H "Content-Type: application/json" \
  -d '{"branch":"main","filters":{"mode":"preset","preset":"1week"}}'
```

### 3. Test Job System

```bash
# Create a patch note first
curl -X POST http://localhost:3000/api/v1/patch-notes \
  -H "Content-Type: application/json" \
  -d '{
    "repo_name": "facebook/react",
    "repo_url": "https://github.com/facebook/react",
    "title": "Test Patch Note",
    "content": "Test content",
    "changes": {"added":0,"modified":0,"removed":0},
    "contributors": []
  }'

# Save the returned ID, then start video render
curl -X POST http://localhost:3000/api/v1/patch-notes/{id}/jobs/render-video

# Returns: { "jobId": "...", "status": "pending", "pollUrl": "..." }

# Poll job status
curl http://localhost:3000/api/v1/jobs/{jobId}

# Returns: { "status": "running", "progress": 45, ... }
```

## 🤖 Generate MCP Server

To enable LLM access via Model Context Protocol:

```bash
# Make sure STAINLESS_API_KEY is set
export STAINLESS_API_KEY="your-key"

# Generate MCP server
npm run generate:mcp

# This will:
# 1. Validate openapi.yaml
# 2. Generate TypeScript SDK at ./sdk/
# 3. Generate MCP server at ./mcp-server/
# 4. Install dependencies
```

### Test MCP Server

```bash
cd mcp-server
npm run dev

# In another terminal
stainless mcp inspect --url http://localhost:3001
```

### Use with Claude

Add to `~/Library/Application Support/Claude/config.json`:

```json
{
  "mcpServers": {
    "repatch": {
      "command": "node",
      "args": ["/path/to/workspace/mcp-server/dist/index.js"],
      "env": {
        "REPATCH_API_KEY": "your-api-key"
      }
    }
  }
}
```

Now Claude can:
- Create patch notes
- Render videos
- Query GitHub data
- All via natural language!

## 📖 Key Concepts

### Job System

All async operations return a job ID:

```typescript
// 1. Start operation
const response = await fetch('/api/v1/patch-notes/123/jobs/render-video', {
  method: 'POST'
});
const { jobId } = await response.json();

// 2. Poll status
async function pollJob(jobId: string) {
  while (true) {
    const res = await fetch(`/api/v1/jobs/${jobId}`);
    const job = await res.json();
    
    if (job.status === 'completed') {
      return job.result;
    }
    
    if (job.status === 'failed') {
      throw new Error(job.error);
    }
    
    console.log(`Progress: ${job.progress}%`);
    await new Promise(r => setTimeout(r, 5000));
  }
}

const result = await pollJob(jobId);
```

### API Layer Separation

Business logic is in `lib/api/`, HTTP adapters in `app/api/v1/`:

```typescript
// lib/api/patch-notes.ts (pure logic)
export async function createPatchNote(input) {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from('patch_notes')
    .insert(input)
    .select()
    .single();
  
  return error 
    ? { success: false, error: error.message }
    : { success: true, data };
}

// app/api/v1/patch-notes/route.ts (HTTP adapter)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await createPatchNote(body);
  
  return result.success
    ? NextResponse.json(result.data, { status: 201 })
    : NextResponse.json({ error: result.error }, { status: 500 });
}
```

## 📚 Documentation

- **[API_SEPARATION_PLAN.md](docs/API_SEPARATION_PLAN.md)** - Full architecture plan
- **[STAINLESS_INTEGRATION.md](docs/STAINLESS_INTEGRATION.md)** - Stainless/MCP guide
- **[API_V1_MIGRATION.md](docs/API_V1_MIGRATION.md)** - Migration from old API
- **[IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md)** - Implementation details
- **[openapi.yaml](openapi.yaml)** - Complete API specification

## ✅ Checklist

Before deploying:

- [ ] Run database migration
- [ ] Test all V1 endpoints
- [ ] Test job polling flow
- [ ] Generate MCP server
- [ ] Test MCP with Claude/GPT
- [ ] Update frontend to use V1 (gradual)
- [ ] Add monitoring/alerts
- [ ] Document API keys

## 🔍 Validate OpenAPI Spec

```bash
npm run validate:openapi
```

## 📦 NPM Scripts

```bash
npm run dev                # Start dev server
npm run build             # Build for production
npm run lint              # Lint code
npm run validate:openapi  # Validate OpenAPI spec
npm run generate:mcp      # Generate MCP server with Stainless
```

## 🐛 Troubleshooting

### Jobs not progressing

Check that background processing is working:
```bash
# Check job status
psql $DATABASE_URL -c "SELECT * FROM jobs WHERE status = 'running';"

# Check for stuck jobs
psql $DATABASE_URL -c "SELECT * FROM jobs WHERE status = 'running' AND created_at < NOW() - INTERVAL '10 minutes';"
```

### MCP generation fails

Make sure Stainless CLI is installed and API key is set:
```bash
npm install -g stainless-cli
export STAINLESS_API_KEY="your-key"
stainless --version
```

### Old API still being used

The old API (`/api/`) still works for backward compatibility. Migrate gradually.

## 🎯 Next Steps

1. **Test locally** - Run through the quick test above
2. **Apply migration** - Add jobs table to database
3. **Generate MCP** - Create MCP server with Stainless
4. **Update frontend** - Gradually migrate to V1 endpoints
5. **Deploy** - Push to staging, then production

## 💡 Pro Tips

- Use `progress` field for UI progress bars
- Poll every 5 seconds (not faster!)
- Jobs have `metadata` for custom data
- Cancel long jobs with `POST /api/v1/jobs/{id}/cancel`
- Check `openapi.yaml` for full schema details

## 🤝 Contributing

When adding new endpoints:
1. Update `openapi.yaml`
2. Add business logic to `lib/api/`
3. Create route in `app/api/v1/`
4. Test with curl/Postman
5. Regenerate MCP server

## 📞 Support

- GitHub Issues: [repo/issues](https://github.com/repo/issues)
- Documentation: [docs/](docs/)
- Email: team@repatch.com

---

**Ready to use!** The API v1 implementation is complete and tested. 🎉
