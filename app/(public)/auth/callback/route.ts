import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { sanitizeRedirect } from '@/lib/auth-redirect';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const redirectPath = sanitizeRedirect(next);

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(new URL('/login?error=auth-code-error', requestUrl.origin));
}


