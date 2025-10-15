import { NextRequest, NextResponse } from "next/server";
import { enforceExternalApiAuth } from "@/lib/api-keys";

export async function middleware(request: NextRequest) {
  const result = await enforceExternalApiAuth(request.headers);

  if (!result.ok) {
    const response = NextResponse.json(result.body, { status: result.status });
    if (result.headers) {
      result.headers.forEach((value, key) => {
        response.headers.set(key, value);
      });
    }
    return response;
  }

  return NextResponse.next({ request: { headers: result.requestHeaders } });
}

export const config = {
  matcher: ["/api/external/:path*"],
};
