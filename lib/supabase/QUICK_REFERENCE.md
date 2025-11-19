# User Management - Quick Reference Card

## 🚀 Quick Start

### 1. Import the helpers

```typescript
import { requireAuth, getCurrentUser } from '@/lib/supabase';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
```

### 2. Require Authentication

```typescript
const cookieStore = await cookies();
const user = await requireAuth(cookieStore);
```

### 3. Create Record with User Ownership

```typescript
const supabase = createServerSupabaseClient(cookieStore);

const { data, error } = await supabase
  .from('ai_templates')
  .insert({
    name: 'My Template',
    content: 'Content here',
    user_id: user.id, // 👈 Always include this
  })
  .select()
  .single();
```

### 4. Query User's Data

```typescript
// RLS automatically filters to current user
const { data } = await supabase
  .from('ai_templates')
  .select('*');
```

## 📋 API Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, requireAuth } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const cookieStore = await cookies();
    const user = await requireAuth(cookieStore);
    
    const supabase = createServerSupabaseClient(cookieStore);
    
    const { data, error } = await supabase
      .from('your_table')
      .insert({
        ...payload,
        user_id: user.id,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Internal error' }, 
      { status: 500 }
    );
  }
}
```

## 🔑 Helper Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `requireAuth(cookies)` | Throw if not authenticated | User object |
| `getCurrentUser(cookies)` | Get user or null | User or null |
| `getCurrentUserProfile(cookies)` | Get user's profile | Profile or null |
| `updateUserProfile(cookies, updates)` | Update profile | Updated profile |
| `ensureUserOwnership(userId, data)` | Add user_id to data | Data with user_id |

## 🗄️ Database Schema

```sql
-- Profiles table
profiles
  ├── id (UUID, PRIMARY KEY, -> auth.users)
  ├── email (TEXT)
  ├── full_name (TEXT)
  ├── avatar_url (TEXT)
  ├── created_at (TIMESTAMPTZ)
  └── updated_at (TIMESTAMPTZ)

-- Updated tables
ai_templates
  └── user_id (UUID, -> auth.users) ✨ NEW

patch_notes
  └── user_id (UUID, -> auth.users) ✨ NEW
```

## 🔒 RLS Policies (Automatic)

Each table has 4 policies:
- ✅ SELECT - View own records
- ✅ INSERT - Create own records  
- ✅ UPDATE - Modify own records
- ✅ DELETE - Remove own records

**RLS automatically filters queries** - you don't need to add `.eq('user_id', user.id)`

## ⚠️ Common Mistakes

### ❌ DON'T: Forget user_id

```typescript
await supabase.from('ai_templates').insert({
  name: 'Test',
  content: 'Test',
  // Missing user_id - will fail!
});
```

### ✅ DO: Include user_id

```typescript
await supabase.from('ai_templates').insert({
  name: 'Test',
  content: 'Test',
  user_id: user.id, // Required
});
```

### ❌ DON'T: Manually filter by user

```typescript
// Redundant - RLS already does this
await supabase
  .from('ai_templates')
  .select('*')
  .eq('user_id', user.id);
```

### ✅ DO: Let RLS handle it

```typescript
// RLS automatically filters to current user
await supabase
  .from('ai_templates')
  .select('*');
```

### ❌ DON'T: Forget authentication check

```typescript
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient(await cookies());
  // No auth check - user might not be logged in!
  const { data } = await supabase.from('ai_templates').select('*');
  return NextResponse.json(data);
}
```

### ✅ DO: Require authentication

```typescript
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  await requireAuth(cookieStore); // Will throw if not authenticated
  
  const supabase = createServerSupabaseClient(cookieStore);
  const { data } = await supabase.from('ai_templates').select('*');
  return NextResponse.json(data);
}
```

## 🔧 Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "new row violates row-level security" | Missing user_id or not authenticated | Add `user_id: user.id` to insert |
| "Authentication required" | User not logged in | Ensure user is authenticated before DB operations |
| No data returned | RLS filtering out data | Check user is owner of the records |
| "relation 'auth.users' does not exist" | Migration not applied | Run `supabase db push` |

## 📚 Full Documentation

- **USER_MANAGEMENT.md** - Complete usage guide
- **MIGRATION_NOTES.md** - Migration instructions
- **API_MIGRATION_GUIDE.md** - API route examples

## 🎯 Migration Checklist

- [ ] Apply migration: `supabase db push`
- [ ] Handle existing data (assign user_id)
- [ ] Update API routes (add auth checks)
- [ ] Include user_id in inserts
- [ ] Test cross-user isolation
- [ ] Add login/signup UI
- [ ] Add middleware for session refresh

---

**Quick Start:** See `SUPABASE_USER_MANAGEMENT_SUMMARY.md` in project root
