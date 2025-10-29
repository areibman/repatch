/**
 * Server-side Supabase client with cookie handling
 * @deprecated Use createServerSupabaseClient from './factory' instead
 * This file is kept for backward compatibility during migration
 */

import { cookies } from 'next/headers';
import { createServerSupabaseClient } from './factory';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerSupabaseClient(cookieStore);
}

