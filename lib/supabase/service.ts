/**
 * Service role Supabase client (bypasses RLS)
 * @deprecated Use createServiceSupabaseClient from './factory' instead
 * This file is kept for backward compatibility during migration
 */

import { createServiceSupabaseClient } from './factory';

export function createServiceClient() {
  return createServiceSupabaseClient();
}
