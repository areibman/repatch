import { NextRequest, NextResponse } from 'next/server';

import { createManagedUser, listManagedUsers } from '@/lib/services';

import {
  ensureUserManagementAuthorized,
  handleServiceError,
  parseListQueryParams,
} from './helpers';

export async function GET(request: NextRequest) {
  const unauthorized = ensureUserManagementAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const filters = parseListQueryParams(request);
    const result = await listManagedUsers(filters);
    return NextResponse.json(result);
  } catch (error) {
    return handleServiceError(error, 'Failed to load users');
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = ensureUserManagementAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = await request.json();
    const created = await createManagedUser(payload);
    const response = NextResponse.json(created, { status: 201 });
    response.headers.set('Location', `/api/users/${created.user.id}`);
    return response;
  } catch (error) {
    return handleServiceError(error, 'Failed to create user');
  }
}

