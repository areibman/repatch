import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { sanitizeRedirect } from "@/lib/auth-redirect";
import { ProtectedShell } from "@/components/auth/protected-shell";
import {
  createServerSupabaseClient,
  getUserOrThrow,
  type AuthContext,
} from "@/lib/supabase";

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  let auth: AuthContext;

  try {
    auth = await getUserOrThrow(supabase);
  } catch (error) {
    const headerList = headers();
    const pathname =
      extractPathname(headerList.get("x-invoke-path")) ??
      extractPathname(headerList.get("x-matched-path")) ??
      extractPathname(headerList.get("referer")) ??
      "/";

    const params = new URLSearchParams();
    params.set("redirectTo", sanitizeRedirect(pathname));
    redirect(`/login?${params.toString()}`);
  }

  return <ProtectedShell auth={auth}>{children}</ProtectedShell>;
}

function extractPathname(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("/")) {
    return value;
  }

  try {
    const url = new URL(value);
    return url.pathname;
  } catch {
    return null;
  }
}


