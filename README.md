# Repatch

AI-generated patch notes from your GitHub repositories, delivered as beautiful newsletters.

## Overview

Repatch uses LLMs to analyze GitHub repository changes over customizable ranges—quick presets, arbitrary date windows, label/tag filters, or specific releases—and generates professional patch notes. The generated content can be edited and sent via email to subscribers.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL)
- **UI**: ShadCN UI + Tailwind CSS
- **Email**: Resend
- **AI**: Google Generative AI (Gemini 2.5 Flash) via Vercel AI SDK
- **Video Generation**: Remotion 4.0 on AWS Lambda

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file with the following:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_VIDEO_BUCKET=videos

# Resend (for sending emails)
RESEND_API_KEY=your_resend_api_key
RESEND_AUDIENCE_ID=your_resend_audience_id

# Typefully (optional tweet thread drafts)
TYPEFULLY_API_KEY=your_typefully_api_key

# GitHub (REQUIRED to avoid rate limits)
GITHUB_TOKEN=ghp_yourTokenHere

# Google AI (for Gemini 2.5 Flash)
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_API_KEY=your_google_api_key

# Optional: App URL for video rendering callbacks
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Internal API secret (for production video rendering)
# Generate with: openssl rand -base64 32
INTERNAL_API_SECRET=change-me-in-production

# AWS Credentials for Remotion Lambda (video rendering)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
REMOTION_APP_FUNCTION_NAME=remotion-render-4-0-355-mem2048mb-disk2048mb-300sec
REMOTION_APP_SERVE_URL=your_s3_site_url
```

**⚠️ Important**: Without a GitHub token, you'll hit rate limits (60 requests/hour). With a token, you get 5,000 requests/hour.

To create a GitHub token:

1. Go to https://github.com/settings/tokens
2. Generate a new classic token with `public_repo` scope
3. Add it to `.env.local` as shown above

### Resend Setup

To set up Resend for email sending:

1. Go to https://resend.com and create an account
2. Get your API key from the dashboard
3. Create an audience for your subscribers:
   - Go to the Audiences section in your Resend dashboard
   - Create a new audience (e.g., "Repatch Subscribers")
   - Copy the audience ID
4. Add both the API key and audience ID to your `.env.local` file

### Typefully Setup

Drafting tweet threads is optional, but if you want to create Typefully drafts directly from a patch note:

1. Create a Typefully account at https://typefully.com/
2. Generate an API key from **Settings → API**
3. Add the key to your `.env.local` as `TYPEFULLY_API_KEY`
4. Open any patch note and click **Draft Tweet Thread** to create a thread draft in your Typefully workspace

### 3. Set Up Supabase

Follow the instructions in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) to:

- Configure your database
- Run migrations
- Add test data

### 4. Run Database Migrations

Make sure to run all migrations, including the latest video_url migration:

```bash
# Run the video_url migration via Supabase CLI
supabase db push

# Or via the Supabase Dashboard SQL Editor:
# Copy and run /supabase/migrations/20250106000000_add_video_url.sql
# Copy and run /supabase/migrations/20250107000000_add_filter_metadata.sql
```

### 5. Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Features

### 🎬 Dynamic Video Generation with Remotion Lambda

Repatch generates custom animated videos for each patch note using **Remotion on AWS Lambda**. This architecture provides:
- **5-10x faster rendering** through parallel chunk processing
- **No timeouts** (15-minute Lambda limit vs 5-minute Vercel limit)
- **~80% cost reduction** compared to Vercel serverless functions
- **2160x1080 resolution** at 30 FPS

#### How It Works

1. When you create a patch note, the app triggers a Lambda render job
2. AWS Lambda fetches your pre-deployed Remotion bundle from S3
3. Multiple Lambda functions render video chunks in parallel
4. Chunks are assembled and stored in S3 with public read access
5. The video URL is saved to your database and displayed in the UI

#### AWS Setup Required

To enable video generation, you need:

1. **AWS Account** with Lambda and S3 access
2. **IAM User** with Remotion Lambda permissions (least-privilege recommended)
3. **Deploy Lambda function** using Remotion CLI:
   ```bash
   npx remotion lambda functions deploy --region us-east-1
   ```
4. **Deploy Remotion site** to S3:
   ```bash
   npx remotion lambda sites create remotion/index.ts --site-name=repatch-video-renderer --region us-east-1
   ```
5. **Configure S3 public access** for rendered videos:
   ```bash
   npx remotion lambda policies public --region us-east-1 --bucket your-bucket-name
   ```

#### Environment Variables

Add these to `.env.local` after deploying to AWS:

```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
REMOTION_APP_FUNCTION_NAME=remotion-render-4-0-355-mem2048mb-disk2048mb-300sec
REMOTION_APP_SERVE_URL=https://your-bucket.s3.us-east-1.amazonaws.com/sites/your-site/index.html
```

The function name and serve URL are returned by the deployment commands above.

#### Redeploying After Changes

If you modify the Remotion composition:

```bash
npx remotion lambda sites create remotion/index.ts --site-name=repatch-video-renderer --region us-east-1
```

The serve URL remains the same, so no environment variable updates needed.

### 🎯 Flexible Filtering Controls

Build summaries from exactly the commits you care about:

- **Quick presets:** Last 24 Hours, Last Week, or Last Month.
- **Custom ranges:** Provide precise start/end timestamps for ad-hoc reporting.
- **Release selection:** Check the releases you want to aggregate; Repatch automatically calculates the commit span between tags.
- **Label & tag filters:** Include/exclude GitHub labels (from linked PRs) or Git tags to highlight the right workstreams.

Example combinations:

```text
Preset: Last Week
Include labels: backend, infra
Exclude tags: legacy-build

Release selection: v1.5.0, v1.5.1
Custom range: 2025-01-01T00:00 → 2025-01-15T23:59
```

Every generated patch note stores the filters that were applied so you can audit and regenerate the same slice of work later.

### 🤖 AI-Powered Summaries

Using Google's Gemini 2.5 Flash, Repatch:
- Analyzes commit diffs for each PR
- Generates concise 1-2 sentence summaries per commit
- Creates an overall summary of all changes
- Processes the top 10 most significant commits

### 📧 Email Newsletters

Send beautiful HTML emails to subscribers with:
- Styled patch note content
- Embedded hero image/video link
- Repository statistics
- Contributor list
- Custom video links (when available)

## Development: Resetting the Database

If you need to rebuild the database from scratch (e.g., to clean up schema drift), follow these steps:

1.  **Snapshot current state**
    -   Ensure `bun install` has run and your `.env.local` contains Supabase service + anon keys.
    -   Export any production data you care about (`supabase db dump --data-only`) because the migration reset will drop everything.

2.  **Trim repository**
    -   The migration history has been consolidated into `supabase/migrations/00000000000000_initial_schema.sql`.

3.  **Apply schema to a clean database**
    -   Run `supabase db reset` locally (creates fresh shadow DB, runs the initial migration).
    -   Verify via `supabase db remote commit` if you maintain branch-based migrations.
    -   Optional: seed with `bun run db:seed` or `bun run scripts/add-sample-data.ts`.

4.  **Regenerate TypeScript bindings**
    -   Execute:
        ```bash
        supabase gen types typescript --project-ref <dev-ref> --schema public > lib/supabase/database.types.ts
        ```
    -   Run `bun run lint` to ensure the codebase compiles against the new types.

5.  **Configure dual Supabase environments**
    -   Create two Supabase projects (dev/prod). Save their URLs/keys in:
        -   `.env.local` → dev project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
        -   `.env.production` → prod project (same variables but prod values).
    -   Link projects: `supabase link --project-ref <dev>` and `supabase link --project-ref <prod> --env prod`.
    -   Workflow: develop migrations locally → `supabase db push` (dev) → validate → `supabase db deploy --env prod`.

## Documentation

- [Supabase Setup](./SUPABASE_SETUP.md) - Database configuration
- [Video Generation](./VIDEO_GENERATION.md) - Remotion video rendering
- [Email Integration](./EMAIL_INTEGRATION.md) - Resend email setup
- [GitHub Integration](./GITHUB_INTEGRATION.md) - GitHub API usage
- [MCP Core Separation](./docs/mcp-core-separation.md) - Core API inventory, consolidation plan, Stainless workflow
- [Core OpenAPI Spec](./openapi/mcp-core.yaml) - Contract driving future `/api/core` routes and MCP tooling
- [Stainless Config](./stainless.config.yml) - CLI settings for generating the MCP server subpackage

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
