import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { cookies } from "next/headers";

import { logAudit } from "@/lib/logging";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  logAudit("auth.callback.received", {
    hasCode: Boolean(code),
    next,
  });

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      logAudit("auth.callback.success", { next });
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    logAudit("auth.callback.exchange_failed", {
      next,
      message: error?.message ?? "Unknown error",
      status: error?.status ?? null,
    });
  }

  logAudit("auth.callback.missing_code", { next });
  // Return the user to an error page with instructions
  return NextResponse.redirect(
    new URL("/login?error=auth-code-error", requestUrl.origin)
  );
}

