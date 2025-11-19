/**
 * Logout Route
 * 
 * Server-side logout endpoint that signs out the user and redirects to home.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  // Sign out the user
  await supabase.auth.signOut();

  // Redirect to home page
  return NextResponse.redirect(new URL('/', request.url));
}
