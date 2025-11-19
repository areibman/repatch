# Migration Notes: User Management Implementation

## Summary

This migration adds comprehensive user management to the Supabase database following official Supabase patterns.

## What Changed

### 1. New Migration File
- **File:** `supabase/migrations/00000000000001_add_user_management.sql`
- **Purpose:** Adds user management schema, RLS policies, and helper functions

### 2. Updated Database Types
- **File:** `lib/supabase/database.types.ts`
- **Changes:**
  - Added `profiles` table type definitions
  - Added `user_id` field to `ai_templates` and `patch_notes`
  - Added `get_current_user_profile` function type
  - Updated relationships to include user foreign keys

## Database Changes Summary

### New Tables
- `profiles` - User profile information linked to auth.users

### Modified Tables
- `ai_templates` - Added `user_id UUID` column
- `patch_notes` - Added `user_id UUID` column

### New Indexes
- `idx_ai_templates_user_id` - Performance optimization for user queries
- `idx_patch_notes_user_id` - Performance optimization for user queries

### RLS Policy Changes

**Before:**
```sql
CREATE POLICY "Allow all access" ON ai_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON patch_notes FOR ALL USING (true) WITH CHECK (true);
```

**After:**
```sql
-- Separate policies for each operation (SELECT, INSERT, UPDATE, DELETE)
-- Each policy checks: auth.uid() = user_id
```

### New Functions
1. `handle_new_user()` - Trigger function to auto-create profiles
2. `get_current_user_profile()` - Helper to retrieve current user's profile

### New Triggers
- `on_auth_user_created` - Automatically creates profile when user signs up

## Breaking Changes

⚠️ **IMPORTANT:** The RLS policies have changed from "allow all" to "user-scoped".

### Impact

1. **Existing data without user_id:**
   - Will NOT be visible to any user (filtered by RLS)
   - Must be assigned to a user or deleted

2. **API calls without authentication:**
   - Will receive empty results (RLS filters everything)
   - Must include proper auth headers

3. **Service role usage:**
   - Previous code using anon key to access all data will now see nothing
   - Must use service role key to bypass RLS (admin operations only)

## Migration Steps

### Step 1: Backup Current Data (if needed)

```bash
# Export existing data
supabase db dump --data-only > backup.sql
```

### Step 2: Apply Migration

```bash
# Push migration to remote database
supabase db push

# Or for local development
supabase db reset
```

### Step 3: Handle Existing Data

Choose one option:

**Option A: Delete test data (recommended for development)**
```sql
TRUNCATE ai_templates CASCADE;
TRUNCATE patch_notes CASCADE;
```

**Option B: Assign to a default user**
```sql
-- First, create a test user or get existing user ID
-- Then assign orphaned records
UPDATE ai_templates 
SET user_id = 'YOUR_USER_UUID' 
WHERE user_id IS NULL;

UPDATE patch_notes 
SET user_id = 'YOUR_USER_UUID' 
WHERE user_id IS NULL;
```

**Option C: Make user_id required (production)**
```sql
-- After all records have user_id set
ALTER TABLE ai_templates 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE patch_notes 
ALTER COLUMN user_id SET NOT NULL;
```

### Step 4: Update Application Code

#### Before (without auth):
```typescript
// This will now return empty results due to RLS
const { data } = await supabase
  .from('ai_templates')
  .select('*');
```

#### After (with auth):
```typescript
// Option 1: User-scoped query (respects RLS)
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Not authenticated');

const { data } = await supabase
  .from('ai_templates')
  .select('*'); // RLS automatically filters to current user

// Option 2: Admin query (bypasses RLS)
const supabaseAdmin = createServiceSupabaseClient();
const { data } = await supabaseAdmin
  .from('ai_templates')
  .select('*'); // Returns ALL templates (use carefully!)
```

### Step 5: Update Insert Operations

#### Before:
```typescript
const { data } = await supabase
  .from('ai_templates')
  .insert({
    name: 'My Template',
    content: 'Template content',
  });
```

#### After:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Not authenticated');

const { data } = await supabase
  .from('ai_templates')
  .insert({
    name: 'My Template',
    content: 'Template content',
    user_id: user.id, // Required!
  });
```

### Step 6: Regenerate Types (if needed)

If you modify the migration, regenerate types:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/database.types.ts
```

## Testing Checklist

After migration, verify:

- [ ] New users automatically get profiles created
- [ ] Users can only see their own templates
- [ ] Users can only see their own patch notes
- [ ] Users cannot access other users' data
- [ ] Insert operations include user_id
- [ ] Update operations respect RLS
- [ ] Delete operations respect RLS
- [ ] Service role can access all data
- [ ] Anonymous users see no data

## Rollback Plan

If you need to rollback:

### 1. Restore permissive policies (temporary)

```sql
-- Drop user-scoped policies
DROP POLICY IF EXISTS "Users can view their own templates" ON ai_templates;
DROP POLICY IF EXISTS "Users can insert their own templates" ON ai_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON ai_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON ai_templates;

DROP POLICY IF EXISTS "Users can view their own patch notes" ON patch_notes;
DROP POLICY IF EXISTS "Users can insert their own patch notes" ON patch_notes;
DROP POLICY IF EXISTS "Users can update their own patch notes" ON patch_notes;
DROP POLICY IF EXISTS "Users can delete their own patch notes" ON patch_notes;

-- Restore permissive policies
CREATE POLICY "Allow all access" ON ai_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON patch_notes FOR ALL USING (true) WITH CHECK (true);
```

### 2. Keep user_id columns (data preserved)

The `user_id` columns can remain - they won't break anything even with permissive policies.

### 3. Full rollback (if needed)

```sql
-- Drop everything from this migration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.get_current_user_profile();

ALTER TABLE ai_templates DROP COLUMN IF EXISTS user_id;
ALTER TABLE patch_notes DROP COLUMN IF EXISTS user_id;

DROP TABLE IF EXISTS profiles;
```

## Common Issues

### Issue: "relation 'auth.users' does not exist"

**Cause:** Migration running before auth schema is set up.

**Solution:**
```sql
-- Verify auth schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth';
```

### Issue: Existing data not visible after migration

**Cause:** Records have NULL user_id and RLS filters them out.

**Solution:** See Step 3 above - assign user_id or delete orphaned records.

### Issue: Cannot insert new records

**Error:** "new row violates row-level security policy"

**Cause:** Not setting user_id or user not authenticated.

**Solution:**
1. Ensure user is authenticated
2. Set user_id to current user's ID
3. Verify INSERT policy exists

## Performance Considerations

### New Indexes Added

```sql
CREATE INDEX idx_ai_templates_user_id ON ai_templates(user_id);
CREATE INDEX idx_patch_notes_user_id ON patch_notes(user_id);
```

These indexes ensure queries filtering by user_id remain fast.

### Query Performance

- **Before:** Full table scans (no filtering)
- **After:** Index-optimized user-scoped queries

RLS policies add a `WHERE user_id = auth.uid()` condition, which uses the indexes for efficient lookups.

## Security Improvements

| Before | After |
|--------|-------|
| Any authenticated user could access all data | Users can only access their own data |
| No user ownership tracking | Clear ownership via user_id |
| Single "allow all" policy | Granular policies per operation |
| No automatic profile management | Auto-created profiles with trigger |

## Next Steps

1. **Implement authentication UI** - Add login/signup pages
2. **Add middleware** - Refresh auth sessions automatically
3. **Create admin panel** - Use service role for admin operations
4. **Add sharing features** - If users need to share templates/notes
5. **Implement team features** - Multi-user access to resources

## Support

For questions or issues:
1. Check `lib/supabase/USER_MANAGEMENT.md` for usage guide
2. Review Supabase docs: https://supabase.com/docs
3. Test RLS policies in Supabase Dashboard
