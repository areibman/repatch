import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { sanitizeRedirect } from "@/lib/auth-redirect";
import { logAuthEvent } from "@/lib/logging";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next");
  const next = sanitizeRedirect(nextParam);

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      logAuthEvent("oauth_code_exchange_succeeded", {
        next,
        origin: requestUrl.origin,
      });
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    logAuthEvent("oauth_code_exchange_failed", {
      error: error.message,
      origin: requestUrl.origin,
    });
  }

  // Return the user to an error page with instructions
  logAuthEvent("oauth_code_missing_or_invalid", {
    hasCode: Boolean(code),
    origin: requestUrl.origin,
  });
  return NextResponse.redirect(
    new URL("/login?error=auth-code-error", requestUrl.origin)
  );
}


