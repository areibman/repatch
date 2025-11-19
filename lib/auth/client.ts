/**
 * Client-side Auth Utilities
 * 
 * Use these functions in Client Components and browser-side code.
 * Based on: https://supabase.com/docs/guides/auth/auth-helpers/nextjs
 */

import { createBrowserSupabaseClient } from '@/lib/supabase';
import type { SignUpCredentials, SignInCredentials } from './types';

/**
 * Sign up a new user with email and password
 */
export async function signUp({ email, password, full_name }: SignUpCredentials) {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign in an existing user with email and password
 */
export async function signIn({ email, password }: SignInCredentials) {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = createBrowserSupabaseClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  // Redirect to home page after sign out
  window.location.href = '/';
}

/**
 * Get the current user from the client
 */
export async function getCurrentUser() {
  const supabase = createBrowserSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * Update the current user's profile
 */
export async function updateProfile(updates: {
  full_name?: string;
  avatar_url?: string;
}) {
  const supabase = createBrowserSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Send a password reset email
 */
export async function resetPassword(email: string) {
  const supabase = createBrowserSupabaseClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) {
    throw error;
  }
}

/**
 * Update the user's password
 */
export async function updatePassword(newPassword: string) {
  const supabase = createBrowserSupabaseClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }
}

/**
 * Sign in with OAuth provider (Google, GitHub, etc.)
 */
export async function signInWithOAuth(provider: 'google' | 'github') {
  const supabase = createBrowserSupabaseClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw error;
  }
}
