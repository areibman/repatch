import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/database.types";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth/callback",
  "/api",
  "/_next",
  "/public",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
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
    data: { user },
  } = await supabase.auth.getUser();

  console.log(`Middleware: Path ${pathname}, Session ${user ? "Found" : "Missing"}`);

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    // Disable automatic redirect from login page to home
    // This prevents redirect loops when client/server session states disagree
    // The login page itself will handle redirection if it detects a valid session client-side
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/|videos/|api/openapi).*)",
  ],
};

