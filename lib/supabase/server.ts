import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from './database.types';
import { usingMockSupabase } from '@/lib/testing/test-environment';
import { createMockSupabaseClient } from './mock-client';

export async function createClient() {
  if (usingMockSupabase()) {
    return createMockSupabaseClient();
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

