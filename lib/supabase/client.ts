import { createBrowserClient } from '@supabase/ssr';
import { Database } from './database.types';
import { createMemoryClient } from './memory';

const useMemorySupabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL === 'memory' ||
  process.env.SUPABASE_USE_MEMORY === 'true';

export function createClient() {
  if (useMemorySupabase) {
    return createMemoryClient() as any;
  }
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

