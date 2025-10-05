# Repatch

AI-generated patch notes from your GitHub repositories, delivered as beautiful newsletters.

## Overview

Repatch uses LLMs to analyze GitHub repository changes over time periods (daily, weekly, monthly) and generates professional patch notes. The generated content can be edited and sent via email to subscribers.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL)
- **UI**: ShadCN UI + Tailwind CSS
- **Email**: Resend (planned)
- **AI**: LiteLLM + AWS Bedrock (planned)

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

### 3. Set Up Supabase

Follow the instructions in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) to:

- Configure your database
- Run migrations
- Add test data

### 4. Run Development Server

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
