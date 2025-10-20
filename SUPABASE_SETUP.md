# Supabase Setup Guide

## Overview
This project uses Supabase as the database solution for storing patch notes and email subscribers.

## Database Schema

### Tables

#### `patch_notes`
Stores AI-generated patch notes from GitHub repositories.

| Column        | Type                       | Description                                    |
|---------------|----------------------------|------------------------------------------------|
| id            | UUID (PK)                  | Unique identifier                              |
| repo_name     | TEXT                       | Repository name (e.g., "owner/repo")           |
| repo_url      | TEXT                       | Full GitHub repository URL                     |
| time_period   | ENUM                       | '1day', '1week', '1month', 'custom', 'release' |
| filter_metadata | JSONB                    | Stored filters (custom ranges, releases, tags) |
| title         | TEXT                       | Patch note title                               |
| content       | TEXT                       | Full patch note content (markdown)             |
| changes       | JSONB                      | {added, modified, removed} line counts         |
| contributors  | TEXT[]                     | Array of contributor usernames                 |
| generated_at  | TIMESTAMP WITH TIME ZONE   | When the patch note was generated              |
| created_at    | TIMESTAMP WITH TIME ZONE   | Record creation timestamp                      |
| updated_at    | TIMESTAMP WITH TIME ZONE   | Record last update timestamp                   |

**Indexes:**
- `idx_patch_notes_repo_name` - On `repo_name` for filtering by repository
- `idx_patch_notes_generated_at` - On `generated_at DESC` for chronological queries
- `idx_patch_notes_time_period` - On `time_period` for filtering by period

#### `email_subscribers`
Stores email addresses for newsletter distribution.

| Column      | Type                       | Description                     |
|-------------|----------------------------|---------------------------------|
| id          | UUID (PK)                  | Unique identifier               |
| email       | TEXT (UNIQUE)              | Subscriber email address        |
| active      | BOOLEAN                    | Whether subscription is active  |
| created_at  | TIMESTAMP WITH TIME ZONE   | Subscription creation timestamp |
| updated_at  | TIMESTAMP WITH TIME ZONE   | Record last update timestamp    |

**Indexes:**
- `idx_email_subscribers_email` - On `email` for fast lookups
- `idx_email_subscribers_active` - On `active` for filtering active subscribers

### Row Level Security (RLS)
Both tables have RLS enabled with permissive policies (all CRUD operations allowed for now). Adjust these policies based on your authentication requirements.

## Setup Instructions

### 1. Environment Variables
Your `.env.local` file has been created with the following variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://jgwkfpdzmehyldevhcna.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
```

### 2. Run Database Migration

You have two options to run the migration:

#### Option A: Using Supabase Dashboard (Recommended)
1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/jgwkfpdzmehyldevhcna
2. Navigate to **SQL Editor**
3. Copy the contents of `/supabase/migrations/20250104000000_initial_schema.sql`
4. Paste into the SQL editor and click **Run**

#### Option B: Using Supabase CLI
```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref jgwkfpdzmehyldevhcna

# Run migrations
supabase db push
```

### 3. Verify Setup
After running the migration, verify the tables were created:
1. Go to **Table Editor** in Supabase dashboard
2. You should see `patch_notes` and `email_subscribers` tables

## API Endpoints

### Patch Notes

#### GET `/api/patch-notes`
Fetch all patch notes, ordered by `generated_at` descending.

**Response:**
```json
[
  {
    "id": "uuid",
    "repo_name": "owner/repo",
    "repo_url": "https://github.com/owner/repo",
    "time_period": "1week",
    "title": "Weekly Update",
    "content": "...",
    "changes": {
      "added": 100,
      "modified": 50,
      "removed": 20
    },
    "contributors": ["@user1", "@user2"],
    "generated_at": "2025-01-04T00:00:00Z",
    "created_at": "2025-01-04T00:00:00Z",
    "updated_at": "2025-01-04T00:00:00Z"
  }
]
```

#### POST `/api/patch-notes`
Create a new patch note.

**Request Body:**
```json
{
  "repo_name": "owner/repo",
  "repo_url": "https://github.com/owner/repo",
  "time_period": "1week",
  "title": "Weekly Update",
  "content": "Markdown content...",
  "changes": {
    "added": 100,
    "modified": 50,
    "removed": 20
  },
  "contributors": ["@user1", "@user2"],
  "generated_at": "2025-01-04T00:00:00Z" // optional
}
```

#### GET `/api/patch-notes/[id]`
Fetch a single patch note by ID.

#### PUT `/api/patch-notes/[id]`
Update a patch note.

**Request Body:** Same as POST, all fields optional

#### DELETE `/api/patch-notes/[id]`
Delete a patch note.

### Email Subscribers

#### GET `/api/subscribers`
Fetch all active email subscribers.

#### POST `/api/subscribers`
Add a new email subscriber.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

## TypeScript Types

The database types are defined in `/lib/supabase/database.types.ts`.

The UI uses a transformed format defined in `/types/patch-note.ts`:
```typescript
interface PatchNote {
  id: string;
  repoName: string;        // maps to repo_name
  repoUrl: string;         // maps to repo_url
  timePeriod: '1day' | '1week' | '1month';  // maps to time_period
  generatedAt: Date;       // maps to generated_at
  title: string;
  content: string;
  changes: {
    added: number;
    modified: number;
    removed: number;
  };
  contributors: string[];
}
```

## Local Development

### Adding Test Data
You can add test data through the Supabase dashboard or via the API:

```bash
curl -X POST http://localhost:3000/api/patch-notes \
  -H "Content-Type: application/json" \
  -d '{
    "repo_name": "test/repo",
    "repo_url": "https://github.com/test/repo",
    "time_period": "1week",
    "title": "Test Patch Note",
    "content": "# Test Content",
    "changes": {"added": 10, "modified": 5, "removed": 2},
    "contributors": ["@tester"]
  }'
```

## Next Steps

1. **Run the migration** using one of the methods above
2. **Add test data** to verify everything works
3. **Integrate LiteLLM + AWS Bedrock** for AI generation
4. **Integrate Resend** for email sending
5. **Add authentication** (optional) and update RLS policies

## Troubleshooting

### Connection Issues
- Verify `.env.local` variables are correct
- Ensure Supabase project is active
- Check network connectivity

### Migration Errors
- Ensure you have proper permissions on the Supabase project
- Check if tables already exist (drop them first if re-running)
- Review error messages in the SQL editor

### API Errors
- Check browser console for detailed error messages
- Verify RLS policies allow the operation
- Ensure request body format is correct

## Security Notes

⚠️ **Current RLS policies are permissive** - they allow all operations without authentication. Before going to production:

1. Set up Supabase Auth
2. Update RLS policies to restrict access
3. Consider using service role key for server-side operations
4. Add rate limiting to API routes

