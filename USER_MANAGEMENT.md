# User Management Implementation Guide

This document describes the user management implementation for the Repatch application, following Supabase's best practices.

## Overview

The application now supports multi-user authentication and authorization using Supabase Auth. All data is isolated per user via Row Level Security (RLS) policies.

## Architecture

### 1. Database Schema

The user management system consists of:

- **`auth.users`** (Supabase managed) - Core authentication table
- **`public.profiles`** - User profile metadata (synced with auth.users)
- **`public.ai_templates`** - Now includes `user_id` column
- **`public.patch_notes`** - Now includes `user_id` column

#### Profiles Table

```sql
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The `profiles` table automatically syncs with `auth.users` via a trigger function that runs on user signup.

### 2. Row Level Security (RLS)

All tables have RLS enabled with user-scoped policies:

#### Profiles RLS Policies
- Users can view their own profile
- Users can update their own profile
- Users can insert their own profile

#### AI Templates RLS Policies
- Users can view their own templates
- Users can create their own templates
- Users can update their own templates
- Users can delete their own templates

#### Patch Notes RLS Policies
- Users can view their own patch notes
- Users can create their own patch notes
- Users can update their own patch notes
- Users can delete their own patch notes

### 3. Authentication Flow

```
┌─────────────────┐
│  User Sign Up   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  auth.users     │ ◄──────── Supabase Auth manages this
└────────┬────────┘
         │
         │ (trigger: on_auth_user_created)
         │
         ▼
┌─────────────────┐
│ public.profiles │ ◄──────── Profile auto-created via trigger
└─────────────────┘
```

## File Structure

```
lib/
├── auth/
│   ├── index.ts          # Barrel export
│   ├── types.ts          # Auth-related types
│   ├── server.ts         # Server-side auth utilities
│   └── client.ts         # Client-side auth utilities
│
components/
└── auth/
    ├── index.ts          # Barrel export
    ├── auth-provider.tsx # Shows user menu or sign-in button
    ├── auth-button.tsx   # Sign-in button component
    ├── user-menu.tsx     # User profile menu with sign-out
    └── protected-route.tsx # HOC for protected routes

app/
└── auth/
    ├── login/
    │   └── page.tsx      # Login page
    ├── signup/
    │   └── page.tsx      # Sign-up page
    ├── callback/
    │   └── route.ts      # OAuth callback handler
    ├── logout/
    │   └── route.ts      # Sign-out endpoint
    ├── forgot-password/
    │   └── page.tsx      # Password reset request
    └── reset-password/
        └── page.tsx      # Password reset form

middleware.ts             # Session refresh middleware
```

## Usage Examples

### Server-Side Authentication

```typescript
import { getUser, getUserProfile, requireAuth } from '@/lib/auth/server';

// Get current user (returns null if not authenticated)
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... rest of handler
}

// Require authentication (throws if not authenticated)
export async function POST() {
  const user = await requireAuth(); // Throws if not authenticated
  // ... rest of handler
}

// Get user profile
export async function MyServerComponent() {
  const profile = await getUserProfile();
  return <div>Welcome, {profile?.full_name}</div>;
}
```

### Client-Side Authentication

```typescript
import { signIn, signUp, signOut, getCurrentUser } from '@/lib/auth/client';

// Sign up
await signUp({
  email: 'user@example.com',
  password: 'password123',
  full_name: 'John Doe'
});

// Sign in
await signIn({
  email: 'user@example.com',
  password: 'password123'
});

// Sign out
await signOut();

// Get current user
const user = await getCurrentUser();
```

### Protected Routes

```typescript
import { ProtectedRoute } from '@/components/auth';

export default async function SettingsPage() {
  return (
    <ProtectedRoute>
      {/* This content is only visible to authenticated users */}
      <div>Protected content</div>
    </ProtectedRoute>
  );
}
```

## Database Operations

### Creating Records

All new records must include the `user_id`:

```typescript
const user = await getUser();
if (!user) throw new Error('Unauthorized');

const { data, error } = await supabase
  .from('patch_notes')
  .insert({
    user_id: user.id, // Required!
    // ... other fields
  })
  .select()
  .single();
```

### Querying Records

RLS policies automatically filter by user, so you don't need to add `.eq('user_id', user.id)`:

```typescript
// This automatically only returns the current user's patch notes
const { data, error } = await supabase
  .from('patch_notes')
  .select('*')
  .order('created_at', { ascending: false });
```

## Migration Guide

### For Existing Data

The migration adds `user_id` columns that will initially be `NULL` for existing data. You have two options:

#### Option 1: Delete Existing Data (Recommended for Development)

```sql
DELETE FROM ai_templates;
DELETE FROM patch_notes;
```

#### Option 2: Assign to a Default User (For Production)

```sql
-- First, create a test user or get an existing user ID
-- Then update existing records:
UPDATE ai_templates SET user_id = 'your-user-uuid' WHERE user_id IS NULL;
UPDATE patch_notes SET user_id = 'your-user-uuid' WHERE user_id IS NULL;
```

### Running the Migration

```bash
# Apply the migration
supabase db push

# Or if using Supabase CLI locally
supabase migration up
```

## Security Considerations

### RLS Policies

- RLS is enabled on all tables
- Policies use `auth.uid()` to identify the current user
- Users can only access their own data
- Service role bypasses RLS (use with caution)

### Service Role Usage

The service role key bypasses all RLS policies. Only use it in trusted server-side code:

```typescript
import { createServiceSupabaseClient } from '@/lib/supabase';

// ⚠️ WARNING: This bypasses RLS!
const supabase = createServiceSupabaseClient();

// Use only for admin operations or background jobs
const { data } = await supabase
  .from('patch_notes')
  .select('*'); // Returns ALL users' data
```

### Middleware

The middleware refreshes user sessions on every request:

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // Automatically refreshes the user's session
  const { data: { user } } = await supabase.auth.getUser();
  // ...
}
```

## OAuth Providers

The application supports OAuth sign-in with:
- Google
- GitHub

To enable OAuth providers, configure them in your Supabase dashboard:
1. Go to Authentication > Providers
2. Enable Google and/or GitHub
3. Add OAuth credentials from Google/GitHub developer consoles
4. Set redirect URLs to: `https://your-domain.com/auth/callback`

## Testing

### Create a Test User

```typescript
// In a test file or script
import { signUp } from '@/lib/auth/client';

await signUp({
  email: 'test@example.com',
  password: 'password123',
  full_name: 'Test User'
});
```

### Test RLS Policies

```sql
-- Connect as a specific user
SET request.jwt.claims = '{"sub": "user-uuid-here"}';

-- Test that queries only return that user's data
SELECT * FROM patch_notes;
```

## Troubleshooting

### Issue: "Unauthorized" errors on all API requests

**Solution**: Ensure you're signed in and the session is valid:
1. Check browser cookies for Supabase auth tokens
2. Verify middleware is running (check middleware.ts)
3. Clear cookies and sign in again

### Issue: Can't see any data after migration

**Solution**: Existing data may have NULL user_id values:
1. Check if records exist: `SELECT COUNT(*) FROM patch_notes WHERE user_id IS NULL;`
2. Either delete the records or assign them to your user ID

### Issue: Service role errors

**Solution**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set:
```bash
# In .env.local
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js with Supabase Auth](https://supabase.com/docs/guides/auth/server-side/nextjs)
