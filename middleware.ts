import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/database.types";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth/callback",
  "/auth/session",
  "/api",
  "/_next",
  "/public",
];

function logMiddleware(message: string, details?: Record<string, unknown>) {
  const payload = details
    ? { ...details, timestamp: new Date().toISOString() }
    : undefined;

  if (payload) {
    console.info("[auth/middleware] %s", message, payload);
    return;
  }

  console.info("[auth/middleware] %s", message);
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    logMiddleware("Supabase env vars missing, skipping auth middleware");
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  // Optimization: Bypass complex middleware logic for API routes and static assets
  // API routes handle their own auth via withApiAuth
  // Static assets don't need auth
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public") ||
    pathname.includes(".") // File extensions
  ) {
      logMiddleware("Bypassing middleware for non-app path", { pathname });
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map(({ name, value }) => ({
            name,
            value,
          }));
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  logMiddleware("Checked session", {
    pathname,
    hasSession: Boolean(session),
    userId: session?.user?.id,
  });

  if (!session && !isPublicPath(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`
    );
    logMiddleware("Redirecting unauthenticated request to login", {
      pathname,
      redirectTo: redirectUrl.toString(),
    });
    return NextResponse.redirect(redirectUrl);
  }

  if (session && pathname === "/login") {
    const redirectTo =
      request.nextUrl.searchParams.get("redirectTo") ?? "/";
    logMiddleware("Redirecting authenticated user away from login", {
      pathname,
      redirectTo,
    });
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/|videos/|api/openapi).*)",
  ],
};

