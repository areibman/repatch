# API Migration Guide: Adding User Authentication

This guide shows how to update your existing API routes to work with the new user management system.

## Key Changes Required

1. **Add authentication checks** - Ensure user is logged in
2. **Include user_id** - Set user_id when creating records
3. **Let RLS handle filtering** - Remove manual user filtering (RLS does it automatically)

## Example: AI Templates API

### Before (No User Management)

```typescript
// app/api/ai-templates/route.ts
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    
    const { data, error } = await supabase
      .from("ai_templates")
      .insert({
        name: payload.name,
        content: payload.content,
        // ❌ No user_id - will fail with new RLS policies
      })
      .select("*")
      .single();
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

### After (With User Management)

```typescript
// app/api/ai-templates/route.ts
import { requireAuth } from "@/lib/supabase/auth-helpers";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    const cookieStore = await cookies();
    
    // ✅ Step 1: Require authentication
    const user = await requireAuth(cookieStore);
    
    const supabase = createServerSupabaseClient(cookieStore);
    
    const { data, error } = await supabase
      .from("ai_templates")
      .insert({
        name: payload.name,
        content: payload.content,
        user_id: user.id, // ✅ Step 2: Set user_id
      })
      .select("*")
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    // ✅ Step 3: Handle auth errors
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: "You must be logged in" }, 
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create template" }, 
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    
    // ✅ Require authentication for GET as well
    await requireAuth(cookieStore);
    
    const supabase = createServerSupabaseClient(cookieStore);
    
    // ✅ RLS automatically filters to current user's templates
    // No need to add .eq('user_id', user.id) - RLS does this!
    const { data, error } = await supabase
      .from("ai_templates")
      .select("*")
      .order("name", { ascending: true });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: "You must be logged in" }, 
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch templates" }, 
      { status: 500 }
    );
  }
}
```

## Migration Checklist for API Routes

For each API route that accesses `ai_templates` or `patch_notes`:

### POST (Create)
- [ ] Add authentication check
- [ ] Include `user_id: user.id` in insert
- [ ] Return 401 if not authenticated

### GET (Read)
- [ ] Add authentication check
- [ ] Remove manual `user_id` filtering (RLS handles it)
- [ ] Return 401 if not authenticated

### PUT/PATCH (Update)
- [ ] Add authentication check
- [ ] No need to verify ownership - RLS prevents updating others' records
- [ ] Return 401 if not authenticated
- [ ] Return 404 if record not found (means user doesn't own it)

### DELETE
- [ ] Add authentication check
- [ ] No need to verify ownership - RLS prevents deleting others' records
- [ ] Return 401 if not authenticated
- [ ] Return 404 if record not found (means user doesn't own it)

## Updated API Routes

Here are the complete updated versions:

### `/app/api/ai-templates/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { mapTemplateRow } from "@/lib/templates";
import { requireAuth } from "@/lib/supabase/auth-helpers";
import type { AiTemplatePayload } from "@/types/ai-template";

export async function GET() {
  try {
    const cookieStore = await cookies();
    await requireAuth(cookieStore);
    
    const supabase = createServerSupabaseClient(cookieStore);
    const { data, error } = await supabase
      .from("ai_templates")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data || []).map(mapTemplateRow));
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: "Authentication required" }, 
        { status: 401 }
      );
    }
    
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to load templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AiTemplatePayload;

    if (!payload.name?.trim()) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    if (!payload.content?.trim()) {
      return NextResponse.json(
        { error: "Template content is required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const user = await requireAuth(cookieStore);
    
    const supabase = createServerSupabaseClient(cookieStore);
    const { data, error } = await supabase
      .from("ai_templates")
      .insert({
        name: payload.name.trim(),
        content: payload.content.trim(),
        user_id: user.id,
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to create template" },
        { status: 500 }
      );
    }

    return NextResponse.json(mapTemplateRow(data), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: "Authentication required" }, 
        { status: 401 }
      );
    }
    
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
```

### `/app/api/ai-templates/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, type Database } from "@/lib/supabase";
import { cookies } from "next/headers";
import { mapTemplateRow } from "@/lib/templates";
import { requireAuth } from "@/lib/supabase/auth-helpers";
import type { AiTemplatePayload } from "@/types/ai-template";

type TemplateUpdate = Database["public"]["Tables"]["ai_templates"]["Update"];
type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as AiTemplatePayload;

    if (!payload.name?.trim()) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    if (!payload.content?.trim()) {
      return NextResponse.json(
        { error: "Template content is required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    await requireAuth(cookieStore);
    
    const supabase = createServerSupabaseClient(cookieStore);
    const update: TemplateUpdate = {
      name: payload.name.trim(),
      content: payload.content.trim(),
    };

    const { data, error } = await supabase
      .from("ai_templates")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      // RLS will cause this to fail if user doesn't own the template
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(mapTemplateRow(data));
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: "Authentication required" }, 
        { status: 401 }
      );
    }
    
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    await requireAuth(cookieStore);
    
    const supabase = createServerSupabaseClient(cookieStore);

    const { error } = await supabase
      .from("ai_templates")
      .delete()
      .eq("id", id);

    if (error) {
      // RLS will prevent deletion if user doesn't own the template
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: "Authentication required" }, 
        { status: 401 }
      );
    }
    
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
```

## Patch Notes API Routes

Apply the same pattern to patch notes routes:

1. Add `await requireAuth(cookieStore)` at the start
2. Include `user_id: user.id` in POST operations
3. Handle 401 errors for unauthenticated requests
4. RLS automatically filters to user's data

## Server Actions

For server actions (used in Server Components), follow the same pattern:

```typescript
'use server';

import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/supabase/auth-helpers';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function createTemplate(formData: FormData) {
  const cookieStore = await cookies();
  const user = await requireAuth(cookieStore);
  
  const supabase = createServerSupabaseClient(cookieStore);
  
  const { data, error } = await supabase
    .from('ai_templates')
    .insert({
      name: formData.get('name') as string,
      content: formData.get('content') as string,
      user_id: user.id,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data;
}
```

## Testing Your Updates

After updating your routes, test:

1. **Unauthenticated access** - Should return 401
   ```bash
   curl http://localhost:3000/api/ai-templates
   # Expected: {"error": "Authentication required"}
   ```

2. **Creating records** - Should set user_id automatically
   ```typescript
   // After creating a template, check it has user_id
   const template = await createTemplate({ name: 'Test', content: 'Test' });
   console.log(template.user_id); // Should be your user's ID
   ```

3. **Cross-user access** - User A should not see User B's data
   ```typescript
   // Sign in as User A, create template
   // Sign out, sign in as User B
   // Try to fetch templates - should not see User A's template
   ```

4. **Update/Delete protection** - User cannot modify others' records
   ```typescript
   // Try to update/delete another user's template
   // Should return 404 (RLS makes it invisible)
   ```

## Common Patterns

### Optional Authentication

If some routes should work without auth:

```typescript
export async function GET() {
  const cookieStore = await cookies();
  const user = await getCurrentUser(cookieStore);
  
  if (!user) {
    // Return public data or empty array
    return NextResponse.json([]);
  }
  
  // Return user's data
  const supabase = createServerSupabaseClient(cookieStore);
  const { data } = await supabase.from('ai_templates').select('*');
  return NextResponse.json(data);
}
```

### Admin Operations

If you need to access all data (admin panel):

```typescript
import { createServiceSupabaseClient } from '@/lib/supabase/factory';

export async function GET() {
  // ⚠️ Make sure this route is protected (e.g., /api/admin/*)
  const cookieStore = await cookies();
  const user = await requireAuth(cookieStore);
  
  // TODO: Check if user is admin
  // if (!user.app_metadata?.role === 'admin') {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }
  
  // Use service role to bypass RLS
  const supabase = createServiceSupabaseClient();
  const { data } = await supabase
    .from('ai_templates')
    .select('*');
  
  return NextResponse.json(data);
}
```

## Summary

The key changes are:
1. ✅ Add authentication checks (`requireAuth`)
2. ✅ Include `user_id` in inserts
3. ✅ Let RLS handle filtering (don't manually filter by user)
4. ✅ Return proper 401 errors
5. ✅ Test cross-user isolation

RLS policies make your job easier - you don't need to manually filter by user_id everywhere!
