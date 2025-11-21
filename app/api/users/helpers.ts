import { NextRequest, NextResponse } from 'next/server';

import { listUsersParamsSchema } from '@/lib/services';

function nilToUndefined(value: string | null) {
  return value === null ? undefined : value;
}

export function hasUserManagementApiKey(request: NextRequest) {
  const expectedKey = process.env.USER_MANAGEMENT_API_KEY;

  if (!expectedKey) {
    return false;
  }

  const providedKey =
    request.headers.get('x-api-key') ?? request.headers.get('authorization');

  return (
    providedKey === expectedKey || providedKey === `Bearer ${expectedKey}`
  );
}

export function parseListQueryParams(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const raw = {
    page: nilToUndefined(searchParams.get('page') ?? searchParams.get('p')),
    perPage: nilToUndefined(
      searchParams.get('perPage') ?? searchParams.get('per_page') ?? searchParams.get('limit')
    ),
    search: nilToUndefined(searchParams.get('search') ?? searchParams.get('q')),
    role: nilToUndefined(searchParams.get('role')),
    activeOnly: nilToUndefined(
      searchParams.get('activeOnly') ?? searchParams.get('active_only')
    ),
  };

  return listUsersParamsSchema.parse(raw);
}

export function handleServiceError(error: unknown, fallback = 'Unexpected error') {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    const typedError = error as { status: number; message: string; details?: unknown };
    return NextResponse.json(
      {
        error: typedError.message,
        details: typedError.details,
      },
      { status: typedError.status }
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 }
  );
}

