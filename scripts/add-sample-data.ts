/**
 * Script to add sample patch notes data to Supabase
 * Run with: npx tsx scripts/add-sample-data.ts
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Make sure .env.local is configured correctly');
  process.exit(1);
}

const sampleData = [
  {
    repo_name: 'acme/awesome-project',
    repo_url: 'https://github.com/acme/awesome-project',
    time_period: '1week',
    title: 'Weekly Update: New Features and Bug Fixes',
    content: `# What's New This Week

We've been hard at work improving the platform! Here's what changed:

## 🚀 New Features

- **Enhanced Authentication**: Implemented OAuth2 support for third-party integrations
- **Dashboard Redesign**: Completely revamped the user dashboard with a modern, intuitive interface
- **Real-time Notifications**: Added WebSocket support for instant updates

## 🐛 Bug Fixes

- Fixed memory leak in the background worker process
- Resolved race condition in the payment processing pipeline
- Corrected timezone handling for international users

## 📈 Performance Improvements

- Reduced API response times by 40%
- Optimized database queries for faster page loads
- Implemented caching layer for frequently accessed data`,
    changes: { added: 2543, modified: 1823, removed: 456 },
    contributors: ['@alice', '@bob', '@charlie', '@diana'],
    generated_at: new Date('2025-10-01').toISOString(),
    filter_metadata: { preset: '1week' },
  },
  {
    repo_name: 'acme/awesome-project',
    repo_url: 'https://github.com/acme/awesome-project',
    time_period: '1month',
    title: 'September Monthly Recap: Major Milestone Release',
    content: `# September Monthly Summary

This month brought significant updates including API v2, mobile app launch, and security enhancements.

## Major Features
- API v2 with GraphQL support
- Mobile app beta launch
- Enhanced security protocols

## Statistics
- 95% test coverage achieved
- 30% performance improvement
- Zero critical bugs in production`,
    changes: { added: 8234, modified: 4521, removed: 1203 },
    contributors: ['@alice', '@bob', '@charlie', '@diana', '@eve', '@frank'],
    generated_at: new Date('2025-09-30').toISOString(),
    filter_metadata: { preset: '1month' },
  },
  {
    repo_name: 'techcorp/api-gateway',
    repo_url: 'https://github.com/techcorp/api-gateway',
    time_period: '1day',
    title: 'Daily Update: Critical Hotfixes',
    content: `# Daily Hotfix Release

Fixed authentication timeout issues and improved rate limiting logic.

## Changes
- Fixed OAuth token refresh mechanism
- Updated rate limiting algorithm
- Improved error logging`,
    changes: { added: 145, modified: 89, removed: 23 },
    contributors: ['@alice', '@bob'],
    generated_at: new Date('2025-10-04').toISOString(),
    filter_metadata: { preset: '1day' },
  },
];

async function addSampleData() {
  console.log('Adding sample data to Supabase...\n');

  for (const data of sampleData) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/patch_notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY!}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Failed to add: ${data.title}`);
        console.error(`   Error: ${error}\n`);
      } else {
        const result = await response.json();
        console.log(`✅ Added: ${data.title}`);
        console.log(`   ID: ${result[0]?.id}\n`);
      }
    } catch (error) {
      console.error(`❌ Error adding ${data.title}:`, error, '\n');
    }
  }

  console.log('Done!');
}

addSampleData();

