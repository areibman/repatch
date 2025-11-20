# Repatch

AI-powered patch notes and release management platform. Automatically generate beautiful patch notes from your GitHub commits, render video summaries, and send newsletters to subscribers.

## Features

- 🤖 **AI-Powered Summaries**: Generate patch notes from commits using AWS Bedrock
- 🎬 **Video Generation**: Automatic video summaries via Remotion Lambda
- 📧 **Email Distribution**: Send newsletters to subscribers via Resend
- 🔄 **GitHub Integration**: Fetch commits, PRs, releases, and more
- 🎨 **Custom Templates**: Create AI prompt templates for your style
- 📊 **Repository Analytics**: Track commits, contributors, and changes
- 🔌 **MCP Integration**: Use with Claude Desktop via Model Context Protocol

## Quick Start

### Prerequisites

- Node.js 18+ (or Bun)
- Supabase account
- GitHub personal access token
- AWS credentials (for Bedrock and Remotion Lambda)
- Resend API key

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/repatch.git
cd repatch

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
# (Instructions in supabase/migrations/)

# Start development server
bun dev
```

Visit `http://localhost:3000`

## Architecture

### Traditional Frontend
```
app/              - Next.js App Router
├── api/          - Original API routes (legacy)
├── page.tsx      - Dashboard
└── settings/     - Settings pages

components/       - React components
```

### New API v1 (MCP-Ready)
```
app/api/v1/       - Versioned API endpoints
lib/api-core/     - Framework-agnostic business logic
openapi.yaml      - OpenAPI 3.1 specification
docs/             - Comprehensive documentation
```

## API v1

The new v1 API provides a clean, versioned interface for:
- GitHub data fetching
- Patch note management
- Async job processing
- Video rendering
- Subscriber management

See `app/api/v1/README.md` for details.

## MCP Integration

Repatch includes full support for Model Context Protocol (MCP), allowing AI assistants like Claude to:
- Create patch notes from conversations
- Query GitHub repositories
- Render videos automatically
- Manage subscribers

### Setup

1. Generate MCP server:
   ```bash
   stainless generate mcp --spec openapi.yaml --output ./mcp-server
   ```

2. Configure Claude Desktop:
   ```json
   {
     "mcpServers": {
       "repatch": {
         "command": "node",
         "args": ["path/to/mcp-server/dist/index.js"],
         "env": {
           "REPATCH_API_URL": "http://localhost:3000/api/v1"
         }
       }
     }
   }
   ```

See `docs/MCP_INTEGRATION.md` for full guide.

## Documentation

- **API Architecture**: `docs/API_ARCHITECTURE.md`
- **Implementation Guide**: `docs/IMPLEMENTATION_GUIDE.md`
- **MCP Integration**: `docs/MCP_INTEGRATION.md`
- **API v1 Reference**: `app/api/v1/README.md`
- **Core API**: `lib/api-core/README.md`

## Development

### Run Tests

```bash
# API v1 tests
bun run test:api

# Linting
bun run lint

# Build
bun run build
```

### Key Commands

```bash
bun dev              # Start dev server
bun run build        # Production build
bun run lint         # Run linter
bun run db:seed      # Seed database
bun run test:api     # Test API v1
bun run preview      # Preview Remotion videos
```

## Environment Variables

Required:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AWS (Bedrock + Remotion Lambda)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# GitHub
GITHUB_TOKEN=

# Resend
RESEND_API_KEY=

# Remotion Lambda
REMOTION_APP_FUNCTION_NAME=
REMOTION_APP_SERVE_URL=
```

See `.env.example` for full list.

## Project Structure

```
/workspace/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   │   ├── v1/             # V1 API (MCP-ready)
│   │   ├── github/         # GitHub endpoints (legacy)
│   │   ├── patch-notes/    # Patch note endpoints (legacy)
│   │   └── ...
│   ├── page.tsx            # Dashboard
│   └── settings/           # Settings pages
├── lib/                    # Business logic
│   ├── api-core/           # Core API (framework-agnostic)
│   ├── services/           # Service layer
│   ├── github/             # GitHub integration
│   ├── supabase/           # Supabase client
│   └── ...
├── components/             # React components
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── remotion/               # Video templates
├── openapi.yaml            # OpenAPI specification
└── package.json
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Update documentation
6. Submit a pull request

See `docs/IMPLEMENTATION_GUIDE.md` for adding new endpoints.

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Environment Setup

1. Add all environment variables in Vercel dashboard
2. Set up Supabase connection pooling
3. Configure AWS credentials
4. Deploy Remotion Lambda function

See `scripts/pre-deploy.sh` for pre-deployment checks.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS
- **API**: Next.js API Routes, Core API layer
- **Database**: Supabase (PostgreSQL)
- **AI**: AWS Bedrock (Claude 3)
- **Video**: Remotion Lambda
- **Email**: Resend
- **GitHub**: Octokit
- **MCP**: Stainless-generated server

## Roadmap

- [x] Basic patch note generation
- [x] Video rendering with Remotion
- [x] Email distribution
- [x] AI templates
- [x] API v1 separation
- [x] OpenAPI specification
- [x] MCP integration documentation
- [ ] Authentication & API keys
- [ ] Production job queue (Redis/PostgreSQL)
- [ ] SDK generation (TypeScript, Python)
- [ ] Webhook signatures
- [ ] Rate limiting
- [ ] Metrics & monitoring

## License

MIT

## Support

- **Issues**: GitHub Issues
- **Documentation**: `/docs` directory
- **Email**: support@repatch.dev (coming soon)

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Video generation by [Remotion](https://remotion.dev/)
- AI powered by [AWS Bedrock](https://aws.amazon.com/bedrock/)
- Database by [Supabase](https://supabase.com/)
- Email by [Resend](https://resend.com/)
- MCP via [Stainless](https://stainless.com/)
