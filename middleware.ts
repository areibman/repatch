import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

const AUTH_PATH = "/login";
const PROTECTED_PATHS = ["/", "/account", "/subscribers", "/settings", "/blog"];

function isProtectedPath(pathname: string) {
  if (pathname.startsWith("/api")) {
    return true;
  }

  return PROTECTED_PATHS.some((path) => {
    if (pathname === path) return true;
    return pathname.startsWith(`${path}/`);
  });
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>(
    { req, res },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith(AUTH_PATH);
  const requiresAuth = isProtectedPath(pathname);

  if (!session && requiresAuth) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const redirectUrl = new URL(AUTH_PATH, req.url);
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/account/:path*",
    "/subscribers/:path*",
    "/settings/:path*",
    "/blog/:path*",
    "/api/:path*",
  ],
};
