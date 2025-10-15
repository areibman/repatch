import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from './database.types';
import { createMockClient } from './mockClient';

export async function createClient() {
  if (process.env.USE_SUPABASE_MOCK === '1' || process.env.NODE_ENV === 'test') {
    return createMockClient();
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

