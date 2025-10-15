import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  const key = serviceRoleKey || anonKey;

  if (!key) {
    throw new Error('Supabase credentials are not configured');
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
    },
  });
}
