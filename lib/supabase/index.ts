/**
 * Supabase client module - Centralized exports
 * 
 * Usage:
 * 
 * ```typescript
 * // Browser-side (client components):
 * import { createBrowserSupabaseClient } from '@/lib/supabase';
 * 
 * // Server-side (API routes, server components):
 * import { createServerSupabaseClient } from '@/lib/supabase';
 * import { cookies } from 'next/headers';
 * const cookieStore = await cookies();
 * const supabase = createServerSupabaseClient(cookieStore);
 * 
 * // Service role (trusted server code only):
 * import { createServiceSupabaseClient } from '@/lib/supabase';
 * const supabase = createServiceSupabaseClient(); // Bypasses RLS!
 * ```
 */

// Primary exports - use these in new code
export {
  createBrowserSupabaseClient,
  createServerSupabaseClient,
  createServiceSupabaseClient,
  SupabaseConfigError,
  isSupabaseConfigError,
  formatSupabaseConfigError,
  type ClientContext,
} from './factory';

// Re-export types
export type { Database } from './database.types';

// Legacy exports for backward compatibility
// These will be removed in a future refactor
export { createClient as createLegacyBrowserClient } from './client';
export { createClient as createLegacyServerClient } from './server';
export { createServiceClient as createLegacyServiceClient } from './service';

