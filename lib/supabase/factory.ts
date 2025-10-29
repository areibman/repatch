/**
 * Centralized Supabase client factory with context-aware client selection
 * and consistent error handling
 */

import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Error types for better error handling
export class SupabaseConfigError extends Error {
  constructor(message: string, public missingVars: string[]) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

// Client context types for type safety
export type ClientContext = 'browser' | 'server' | 'service';

// Configuration interface
interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

/**
 * Validate and retrieve Supabase configuration from environment variables
 */
function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missingVars: string[] = [];
  
  if (!url) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!anonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (missingVars.length > 0) {
    throw new SupabaseConfigError(
      `Missing required Supabase environment variables: ${missingVars.join(', ')}`,
      missingVars
    );
  }

  // TypeScript now knows these are defined (we checked above)
  return {
    url: url as string,
    anonKey: anonKey as string,
    serviceRoleKey,
  };
}

/**
 * Create a browser-side Supabase client
 * Use this in client components and browser-side code
 */
export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  const config = getSupabaseConfig();
  
  return createBrowserClient<Database>(config.url, config.anonKey);
}

/**
 * Create a server-side Supabase client with cookie handling
 * Use this in server components, API routes, and server actions
 * 
 * @param cookieStore - Next.js cookies() instance for SSR cookie handling
 */
export function createServerSupabaseClient(
  cookieStore: {
    getAll(): Array<{ name: string; value: string }>;
    set(name: string, value: string, options?: Record<string, unknown>): void;
  }
): SupabaseClient<Database> {
  const config = getSupabaseConfig();

  return createServerClient<Database>(config.url, config.anonKey, {
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
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

/**
 * Create a service role Supabase client (bypasses RLS)
 * Use this ONLY in trusted server-side code where you need elevated permissions
 * 
 * WARNING: This client bypasses Row Level Security policies.
 * Never expose this client to the browser or untrusted code.
 */
export function createServiceSupabaseClient(): SupabaseClient<Database> {
  const config = getSupabaseConfig();

  if (!config.serviceRoleKey) {
    throw new SupabaseConfigError(
      'Service role client requires SUPABASE_SERVICE_ROLE_KEY environment variable',
      ['SUPABASE_SERVICE_ROLE_KEY']
    );
  }

  return createSupabaseClient<Database>(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Type guard to check if an error is a SupabaseConfigError
 */
export function isSupabaseConfigError(error: unknown): error is SupabaseConfigError {
  return error instanceof SupabaseConfigError;
}

/**
 * Helper to format Supabase config errors for logging/debugging
 */
export function formatSupabaseConfigError(error: SupabaseConfigError): string {
  return `${error.message}\n\nTo fix this:\n${error.missingVars
    .map((v) => `  - Set ${v} in your .env.local file`)
    .join('\n')}`;
}

