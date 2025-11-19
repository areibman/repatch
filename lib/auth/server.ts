/**
 * Server-side Auth Utilities
 * 
 * Use these functions in Server Components, Server Actions, and API Routes.
 * Based on: https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { Profile } from './types';

/**
 * Get the currently authenticated user from the server
 * Returns null if no user is authenticated
 */
export async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Get the current user's profile from the database
 * Returns null if no user is authenticated or profile doesn't exist
 */
export async function getUserProfile(): Promise<Profile | null> {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Require authentication - throws an error if user is not authenticated
 * Use this in Server Actions or API Routes that require authentication
 */
export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    throw new Error('Unauthorized - Authentication required');
  }
  return user;
}

/**
 * Check if a user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getUser();
  return !!user;
}

/**
 * Get the user's session from the server
 */
export async function getSession() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}
