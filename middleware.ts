import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-keys';
import { MemoryRateLimiter } from '@/lib/rate-limit';

const limiter = new MemoryRateLimiter(60, 60_000);

export async function middleware(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing X-Api-Key header' }, { status: 401 });
  }

  const validation = await validateApiKey(apiKey).catch((error) => {
    console.error('Failed to validate API key', error);
    return { valid: false, status: 500, message: 'Internal authentication error' } as const;
  });

  if (!validation.valid) {
    return NextResponse.json({ error: validation.message }, {
      status: validation.status,
    });
  }

  const rate = limiter.take(validation.key.id);

  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': rate.retryAfter.toString(),
          'X-RateLimit-Limit': limiter.getLimit().toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rate.resetAt / 1000).toString(),
        },
      }
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-authenticated-api-key-id', validation.key.id);
  requestHeaders.set('x-authenticated-api-key-prefix', validation.key.tokenPrefix);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('X-RateLimit-Limit', limiter.getLimit().toString());
  response.headers.set('X-RateLimit-Remaining', rate.remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(rate.resetAt / 1000).toString());

  return response;
}

export const config = {
  matcher: ['/api/external/:path*'],
};
