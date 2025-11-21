import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { cookies } from "next/headers";

function logAuthCallback(message: string, details?: Record<string, unknown>) {
  const payload = details
    ? { ...details, timestamp: new Date().toISOString() }
    : undefined;

  if (payload) {
    console.info("[auth/callback] %s", message, payload);
    return;
  }

  console.info("[auth/callback] %s", message);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  logAuthCallback("Processing auth callback", {
    hasCode: Boolean(code),
    next,
  });

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] Failed to exchange code", {
        message: error.message,
        status: error.status,
      });
    }

    if (!error) {
      logAuthCallback("Successfully exchanged code, redirecting user", {
        next,
      });
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  logAuthCallback("Redirecting to login due to missing/invalid code");
  // Return the user to an error page with instructions
  return NextResponse.redirect(
    new URL("/login?error=auth-code-error", requestUrl.origin)
  );
}


