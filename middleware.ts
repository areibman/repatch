import { NextResponse, type NextRequest } from "next/server";
import { validateApiKey, touchApiKeyUsage } from "@/lib/api-keys/auth";

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/external/")) {
    return NextResponse.next();
  }

  try {
    const result = await validateApiKey(request.headers.get("x-api-key"));
    if (!result.ok) {
      const headers = new Headers();
      if (result.retryAfter) {
        headers.set("Retry-After", result.retryAfter.toString());
      }
      return NextResponse.json(
        { error: result.message },
        { status: result.status, headers }
      );
    }

    const headers = new Headers(request.headers);
    headers.set("x-api-key-id", result.record.id);
    headers.set("x-rate-limit-limit", (result.record.rate_limit_per_minute ?? 60).toString());

    void touchApiKeyUsage(result.record.id);

    return NextResponse.next({
      request: { headers },
    });
  } catch (error) {
    console.error("API key middleware failure", error);
    return NextResponse.json(
      { error: "Unable to authenticate request" },
      { status: 500 }
    );
  }
}

export const config = {
  matcher: ["/api/external/:path*"],
};
