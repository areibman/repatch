# Supabase Client Architecture

This directory contains a centralized, type-safe Supabase client factory that replaces the previous scattered client implementations.

## Architecture Overview

```
lib/supabase/
├── factory.ts          # Core factory with type-safe client creation
├── index.ts           # Public API exports
├── database.types.ts  # Auto-generated Supabase types
├── client.ts          # Legacy browser client (deprecated)
├── server.ts          # Legacy server client (deprecated)
└── service.ts         # Legacy service client (deprecated)
```

## Usage

### Browser Client (Client Components)

Use in React client components and browser-side code:

```typescript
import { createBrowserSupabaseClient } from '@/lib/supabase';

export default function MyComponent() {
  const supabase = createBrowserSupabaseClient();
  
  // Use for authenticated user queries with RLS
  const { data } = await supabase.from('patch_notes').select('*');
}
```

### Server Client (API Routes, Server Components)

Use in Next.js API routes and server components where cookie handling is needed:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  
  // Respects user authentication and RLS policies
  const { data } = await supabase.from('patch_notes').select('*');
  
  return Response.json(data);
}
```

### Service Client (Privileged Server Operations)

⚠️ **WARNING**: This client bypasses Row Level Security. Use only in trusted server-side code.

```typescript
import { createServiceSupabaseClient } from '@/lib/supabase';

export async function backgroundJob() {
  const supabase = createServiceSupabaseClient();
  
  // Has full database access, bypasses RLS
  const { data } = await supabase
    .from('patch_notes')
    .update({ processing_status: 'completed' })
    .eq('id', patchNoteId);
}
```

## Error Handling

The factory provides typed errors for configuration issues:

```typescript
import { 
  createServiceSupabaseClient, 
  isSupabaseConfigError,
  formatSupabaseConfigError 
} from '@/lib/supabase';

try {
  const supabase = createServiceSupabaseClient();
} catch (error) {
  if (isSupabaseConfigError(error)) {
    console.error(formatSupabaseConfigError(error));
    // Shows: "Missing required Supabase environment variables: SUPABASE_SERVICE_ROLE_KEY"
    //        To fix this:
    //          - Set SUPABASE_SERVICE_ROLE_KEY in your .env.local file
  }
}
```

## Environment Variables

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key

Optional (only for service role operations):
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)

## Migration Guide

### From `lib/supabase/client.ts`

```typescript
// OLD (deprecated):
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

// NEW:
import { createBrowserSupabaseClient } from '@/lib/supabase';
const supabase = createBrowserSupabaseClient();
```

### From `lib/supabase/server.ts`

```typescript
// OLD (deprecated):
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();

// NEW:
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
const cookieStore = await cookies();
const supabase = createServerSupabaseClient(cookieStore);
```

### From `lib/supabase/service.ts`

```typescript
// OLD (deprecated):
import { createServiceClient } from '@/lib/supabase/service';
const supabase = createServiceClient();

// NEW:
import { createServiceSupabaseClient } from '@/lib/supabase';
const supabase = createServiceSupabaseClient();
```

## Benefits of New Architecture

1. **Type Safety**: Client context is enforced at the type level
2. **Centralized Config**: All environment variable validation in one place
3. **Better Error Messages**: Specific errors for missing configuration
4. **Consistent API**: All clients follow the same creation pattern
5. **Easier Testing**: Factory pattern simplifies mocking
6. **Future-Proof**: Easy to swap database providers or add features

## Design Decisions

### Why a Factory Pattern?

The factory pattern centralizes client creation logic, making it easier to:
- Add caching or connection pooling later
- Implement feature flags or A/B testing for database providers
- Mock clients consistently in tests
- Audit service role key usage from a single location

### Why Separate Functions Instead of a Single Factory?

```typescript
// We chose THIS:
createBrowserSupabaseClient()
createServerSupabaseClient(cookies)
createServiceSupabaseClient()

// Instead of THIS:
createSupabaseClient('browser')
createSupabaseClient('server', cookies)
createSupabaseClient('service')
```

Reasons:
1. **Type Safety**: TypeScript can enforce required parameters per context
2. **Self-Documenting**: Function names make the context explicit
3. **Tree Shaking**: Unused client types can be removed by bundlers
4. **IDE Support**: Better autocomplete and parameter hints

### Why Keep Legacy Files?

During the migration period:
- Existing code continues to work
- Migration can happen incrementally
- Clear deprecation warnings guide developers
- Less risk of breaking changes

Once all code is migrated, the legacy files will be removed.

