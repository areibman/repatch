/**
 * Helper functions for user authentication and profile management
 * 
 * These utilities simplify common auth operations following Supabase best practices.
 */

import { createServerSupabaseClient } from './factory';
import type { Database } from './database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/**
 * Get the current authenticated user
 * 
 * @param cookieStore - Next.js cookies() instance
 * @returns User object or null if not authenticated
 */
export async function getCurrentUser(cookieStore: {
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options?: Record<string, unknown>): void;
}) {
  const supabase = createServerSupabaseClient(cookieStore);
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

/**
 * Get the current user's profile
 * 
 * @param cookieStore - Next.js cookies() instance
 * @returns Profile object or null if not found
 */
export async function getCurrentUserProfile(cookieStore: {
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options?: Record<string, unknown>): void;
}): Promise<Profile | null> {
  const supabase = createServerSupabaseClient(cookieStore);
  
  const { data, error } = await supabase
    .rpc('get_current_user_profile')
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  
  return data;
}

/**
 * Update the current user's profile
 * 
 * @param cookieStore - Next.js cookies() instance
 * @param updates - Profile fields to update
 * @returns Updated profile or null if failed
 */
export async function updateUserProfile(
  cookieStore: {
    getAll(): Array<{ name: string; value: string }>;
    set(name: string, value: string, options?: Record<string, unknown>): void;
  },
  updates: ProfileUpdate
): Promise<Profile | null> {
  const user = await getCurrentUser(cookieStore);
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const supabase = createServerSupabaseClient(cookieStore);
  
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating profile:', error);
    return null;
  }
  
  return data;
}

/**
 * Require authentication - throws if user is not authenticated
 * 
 * Use this in server actions or API routes to ensure user is logged in
 * 
 * @param cookieStore - Next.js cookies() instance
 * @returns Authenticated user
 * @throws Error if not authenticated
 */
export async function requireAuth(cookieStore: {
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options?: Record<string, unknown>): void;
}) {
  const user = await getCurrentUser(cookieStore);
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}

/**
 * Check if a user owns a specific resource
 * 
 * @param userId - The user ID to check
 * @param resourceUserId - The user_id field from the resource
 * @returns true if user owns the resource
 */
export function userOwnsResource(
  userId: string,
  resourceUserId: string | null
): boolean {
  return resourceUserId === userId;
}

/**
 * Ensure a record has the correct user_id before insert
 * 
 * @param userId - Current user's ID
 * @param data - Data to insert
 * @returns Data with user_id set
 */
export function ensureUserOwnership<T extends { user_id?: string | null }>(
  userId: string,
  data: T
): T & { user_id: string } {
  return {
    ...data,
    user_id: userId,
  };
}
