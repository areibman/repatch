import { NextResponse, type NextRequest } from 'next/server';
import { handleExternalApiAuth } from '@/lib/api-keys/middleware';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/external')) {
    return handleExternalApiAuth(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/external/:path*'],
};
