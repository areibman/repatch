# User Management Implementation

This document describes the user management implementation following Supabase best practices.

## Overview

The database now includes proper user management with Row Level Security (RLS) policies that ensure users can only access their own data.

## Schema Changes

### 1. Profiles Table

A new `profiles` table has been added that references `auth.users`:

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Features:**
- Automatically created when a user signs up (via trigger)
- Links to Supabase Auth's `auth.users` table
- Cascades deletes (when a user is deleted, their profile is deleted)
- Stores additional user metadata

### 2. User Ownership

Both `ai_templates` and `patch_notes` tables now have a `user_id` column:

```sql
ALTER TABLE ai_templates ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE patch_notes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
```

**Benefits:**
- Clear ownership model
- Cascading deletes for data cleanup
- Indexed for performance

## Row Level Security (RLS) Policies

All tables now have proper RLS policies instead of the previous "allow all" approach.

### Profiles Policies

```sql
-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
```

### AI Templates Policies

```sql
-- Users can only access their own templates
CREATE POLICY "Users can view their own templates"
    ON ai_templates FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates"
    ON ai_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
    ON ai_templates FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
    ON ai_templates FOR DELETE
    USING (auth.uid() = user_id);
```

### Patch Notes Policies

Similar policies apply to `patch_notes` - users can only SELECT, INSERT, UPDATE, and DELETE their own patch notes.

## Automatic Profile Creation

When a user signs up through Supabase Auth, a profile is automatically created:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
```

## Helper Functions

### Get Current User Profile

```sql
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS SETOF profiles AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM profiles
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage in TypeScript:**

```typescript
const { data: profile, error } = await supabase
  .rpc('get_current_user_profile')
  .single();
```

## Usage Guide

### 1. Creating Records with User Ownership

When inserting records, always include the user_id:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/factory';
import { cookies } from 'next/headers';

export async function createTemplate(name: string, content: string) {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('ai_templates')
    .insert({
      name,
      content,
      user_id: user.id, // Critical: set the user_id
    })
    .select()
    .single();

  return { data, error };
}
```

### 2. Querying User's Data

RLS policies automatically filter data, but you should still be explicit:

```typescript
export async function getUserTemplates() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  
  // RLS automatically filters to current user's templates
  const { data, error } = await supabase
    .from('ai_templates')
    .select('*')
    .order('created_at', { ascending: false });

  return { data, error };
}
```

### 3. Updating User Profile

```typescript
export async function updateProfile(updates: {
  full_name?: string;
  avatar_url?: string;
}) {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  return { data, error };
}
```

### 4. Service Role for Admin Operations

If you need to bypass RLS (e.g., for admin operations or background jobs), use the service role client:

```typescript
import { createServiceSupabaseClient } from '@/lib/supabase/factory';

export async function adminGetAllTemplates() {
  // ⚠️ WARNING: Bypasses RLS - use only in trusted server-side code
  const supabase = createServiceSupabaseClient();
  
  const { data, error } = await supabase
    .from('ai_templates')
    .select('*');

  return { data, error };
}
```

## Migration Path

### Applying the Migration

1. Ensure you have Supabase CLI installed
2. Run the migration:
   ```bash
   supabase db push
   ```

### Migrating Existing Data

If you have existing data without `user_id` values, you'll need to:

1. **Option A: Delete old data** (if it's test data)
   ```sql
   TRUNCATE ai_templates CASCADE;
   TRUNCATE patch_notes CASCADE;
   ```

2. **Option B: Assign to a user** (if you want to keep the data)
   ```sql
   -- Get a user ID (replace with actual user)
   -- SELECT id FROM auth.users LIMIT 1;
   
   UPDATE ai_templates SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
   UPDATE patch_notes SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
   ```

3. **Option C: Make user_id NOT NULL** (for production)
   ```sql
   -- After assigning all rows
   ALTER TABLE ai_templates ALTER COLUMN user_id SET NOT NULL;
   ALTER TABLE patch_notes ALTER COLUMN user_id SET NOT NULL;
   ```

## Authentication Setup

To enable user authentication in your Next.js app, follow these steps:

### 1. Environment Variables

Ensure these are set in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Create Auth Components

Example login component:

```typescript
'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/factory';
import { useState } from 'react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const supabase = createBrowserSupabaseClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error.message);
    } else {
      console.log('Logged in:', data.user);
      // Redirect or update UI
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Log In</button>
    </form>
  );
}
```

### 3. Add Middleware for Auth State

Create `middleware.ts` in the root:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if needed
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

## Security Considerations

1. **Never expose service role key** - Keep it server-side only
2. **Always validate user_id** - When creating records, ensure user_id matches authenticated user
3. **Test RLS policies** - Verify users can't access others' data
4. **Use HTTPS** - Always use HTTPS in production
5. **Monitor auth events** - Set up logging for suspicious auth activity

## Testing RLS Policies

To test that RLS is working correctly:

```typescript
// Test file: lib/supabase/__tests__/rls.test.ts
import { createServerSupabaseClient } from '@/lib/supabase/factory';

describe('RLS Policies', () => {
  it('should only return current user templates', async () => {
    const supabase = createServerSupabaseClient(mockCookieStore);
    
    // Sign in as user A
    await supabase.auth.signInWithPassword({
      email: 'userA@example.com',
      password: 'password',
    });

    // Create template
    const { data: template } = await supabase
      .from('ai_templates')
      .insert({ name: 'Test', content: 'Test content' })
      .select()
      .single();

    // Sign out and sign in as user B
    await supabase.auth.signOut();
    await supabase.auth.signInWithPassword({
      email: 'userB@example.com',
      password: 'password',
    });

    // Try to access user A's template
    const { data: templates } = await supabase
      .from('ai_templates')
      .select('*')
      .eq('id', template!.id);

    // Should be empty - user B can't see user A's templates
    expect(templates).toHaveLength(0);
  });
});
```

## Troubleshooting

### "new row violates row-level security policy"

**Cause:** Trying to insert a record without proper authentication or wrong user_id.

**Solution:**
1. Ensure user is authenticated: `await supabase.auth.getUser()`
2. Set user_id to authenticated user's ID
3. Check that INSERT policy allows the operation

### "No rows returned" when data exists

**Cause:** RLS policy is filtering out the data.

**Solution:**
1. Verify you're authenticated
2. Check that user_id matches current user
3. Review SELECT policy conditions

### Profile not created on signup

**Cause:** Trigger might not be enabled or function has errors.

**Solution:**
1. Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created'`
2. Review function logs in Supabase dashboard
3. Manually create profile if needed

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Next.js Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
