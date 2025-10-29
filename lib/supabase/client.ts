/**
 * Browser-side Supabase client
 * @deprecated Use createBrowserSupabaseClient from './factory' instead
 * This file is kept for backward compatibility during migration
 */

import { createBrowserSupabaseClient } from './factory';

export function createClient() {
  return createBrowserSupabaseClient();
}

