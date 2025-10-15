import { Database } from "@/lib/supabase/database.types";

export const samplePatchNotes: Database["public"]["Tables"]["patch_notes"]["Row"][] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    repo_name: "acme/awesome-project",
    repo_url: "https://github.com/acme/awesome-project",
    time_period: "1week",
    title: "Weekly Update: New Features and Bug Fixes",
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
    contributors: ["@alice", "@bob", "@charlie", "@diana"],
    generated_at: new Date("2025-10-01").toISOString(),
    created_at: new Date("2025-10-01").toISOString(),
    updated_at: new Date("2025-10-01").toISOString(),
    ai_overall_summary: null,
    ai_summaries: null,
    video_data: null,
    video_url: null,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    repo_name: "acme/awesome-project",
    repo_url: "https://github.com/acme/awesome-project",
    time_period: "1month",
    title: "September Monthly Recap: Major Milestone Release",
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
    contributors: ["@alice", "@bob", "@charlie", "@diana", "@eve", "@frank"],
    generated_at: new Date("2025-09-30").toISOString(),
    created_at: new Date("2025-09-30").toISOString(),
    updated_at: new Date("2025-09-30").toISOString(),
    ai_overall_summary: null,
    ai_summaries: null,
    video_data: null,
    video_url: null,
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    repo_name: "techcorp/api-gateway",
    repo_url: "https://github.com/techcorp/api-gateway",
    time_period: "1day",
    title: "Daily Update: Critical Hotfixes",
    content: `# Daily Hotfix Release

Fixed authentication timeout issues and improved rate limiting logic.

## Changes
- Fixed OAuth token refresh mechanism
- Updated rate limiting algorithm
- Improved error logging`,
    changes: { added: 145, modified: 89, removed: 23 },
    contributors: ["@alice", "@bob"],
    generated_at: new Date("2025-10-04").toISOString(),
    created_at: new Date("2025-10-04").toISOString(),
    updated_at: new Date("2025-10-04").toISOString(),
    ai_overall_summary: null,
    ai_summaries: null,
    video_data: null,
    video_url: null,
  },
];

export type MockSubscriber = {
  id: string;
  email: string;
  unsubscribed: boolean;
  created_at: string;
  updated_at: string;
};

export const sampleSubscribers: MockSubscriber[] = [
  {
    id: "sub-1",
    email: "dev@acme.dev",
    unsubscribed: false,
    created_at: new Date("2025-09-29T12:00:00Z").toISOString(),
    updated_at: new Date("2025-09-29T12:00:00Z").toISOString(),
  },
  {
    id: "sub-2",
    email: "pm@acme.dev",
    unsubscribed: false,
    created_at: new Date("2025-09-30T08:15:00Z").toISOString(),
    updated_at: new Date("2025-09-30T08:15:00Z").toISOString(),
  },
  {
    id: "sub-3",
    email: "inactive@acme.dev",
    unsubscribed: true,
    created_at: new Date("2025-09-30T16:45:00Z").toISOString(),
    updated_at: new Date("2025-10-01T09:00:00Z").toISOString(),
  },
];

export type MockGithubConfig = {
  id: string;
  repo_url: string;
  repo_owner: string | null;
  repo_name: string | null;
  access_token: string;
  created_at: string;
  updated_at: string;
};

export const initialGithubConfigs: MockGithubConfig[] = [];
