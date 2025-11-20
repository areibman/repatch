import { NextResponse } from 'next/server';

export function ensureUserManagementAccess(
  request: Request
): NextResponse | null {
  const secret = process.env.USER_MANAGEMENT_API_KEY;

  if (!secret) {
    return NextResponse.json(
      {
        error:
          'USER_MANAGEMENT_API_KEY is not configured. Set it in your environment to secure the user management API.',
      },
      { status: 500 }
    );
  }

  const provided = extractToken(request);

  if (!provided || provided !== secret) {
    return NextResponse.json(
      { error: 'Unauthorized request' },
      {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer realm="user-management"' },
      }
    );
  }

  return null;
}

function extractToken(request: Request): string | null {
  const bearer = request.headers.get('authorization');
  if (bearer && bearer.toLowerCase().startsWith('bearer ')) {
    return bearer.slice('bearer '.length).trim();
  }

  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    return apiKey.trim();
  }

  return null;
}
