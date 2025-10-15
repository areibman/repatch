# Repatch

AI-generated patch notes from your GitHub repositories, delivered as beautiful newsletters.

## Overview

Repatch uses LLMs to analyze GitHub repository changes over time periods (daily, weekly, monthly) and generates professional patch notes. The generated content can be edited and sent via email to subscribers.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL)
- **UI**: ShadCN UI + Tailwind CSS
- **Email**: Resend
- **Social**: Typefully (Twitter/X threads)
- **AI**: Google Generative AI (Gemini 2.5 Flash) via Vercel AI SDK
- **Video Generation**: Remotion 4.0

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

# Resend (for sending emails)
RESEND_API_KEY=your_resend_api_key
RESEND_AUDIENCE_ID=your_resend_audience_id

# GitHub (REQUIRED to avoid rate limits)
GITHUB_TOKEN=ghp_yourTokenHere

# Google AI (for Gemini 2.5 Flash)
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_API_KEY=your_google_api_key

# Optional: App URL for video rendering callbacks
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Typefully (for Twitter/X threads)
# Option A: Store in DB via Integrations > Typefully > Connect
# Option B: Provide env vars (fallback)
TYPEFULLY_API_KEY=your_typefully_api_key
TYPEFULLY_PROFILE_ID=your_typefully_profile_id
# Optional: Only if you use teams
TYPEFULLY_TEAM_ID=your_typefully_team_id
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

To queue Twitter/X threads via Typefully:

1. Read the API docs at https://support.typefully.com/en/articles/8718287-typefully-api
2. Get an API key and your profile ID (and optionally a team ID)
3. Configure via the app UI: Integrations → Typefully → Connect
   - Or set env vars: `TYPEFULLY_API_KEY`, `TYPEFULLY_PROFILE_ID`, and optionally `TYPEFULLY_TEAM_ID`
4. On a patch note page, click "Queue Twitter thread" (or "+ video" to render and attach the Remotion video first)

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

### 🎬 Dynamic Video Generation

Repatch automatically generates custom videos for each patch note using Remotion! Videos are:
- Generated in the background after creating a patch note
- Stored locally in `/public/videos/`
- Displayed in blog posts and email newsletters
- Resolution: 2160x1080 (2K) at 30 FPS

For more details, see [VIDEO_GENERATION.md](./VIDEO_GENERATION.md).

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

## Documentation

- [Supabase Setup](./SUPABASE_SETUP.md) - Database configuration
- [Video Generation](./VIDEO_GENERATION.md) - Remotion video rendering
- [Email Integration](./EMAIL_INTEGRATION.md) - Resend email setup
- [GitHub Integration](./GITHUB_INTEGRATION.md) - GitHub API usage

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
