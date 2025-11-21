import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { sanitizeRedirect } from '@/lib/auth-redirect';
import { getAppBaseUrl } from '@/lib/url';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const redirectPath = sanitizeRedirect(next);
  const appBaseUrl = getAppBaseUrl({ fallback: requestUrl.origin });

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(new URL(redirectPath, appBaseUrl));
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(
    new URL('/login?error=auth-code-error', appBaseUrl)
  );
}


