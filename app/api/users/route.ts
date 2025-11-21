import { NextRequest, NextResponse } from 'next/server';

import { createManagedUser, listManagedUsers } from '@/lib/services';
import { withApiAuth } from '@/lib/api/with-auth';
import { requireRole } from '@/lib/supabase';

import {
  hasUserManagementApiKey,
  handleServiceError,
  parseListQueryParams,
} from './helpers';

async function handleListUsers(request: NextRequest) {
  try {
    const filters = parseListQueryParams(request);
    const result = await listManagedUsers(filters);
    return NextResponse.json(result);
  } catch (error) {
    return handleServiceError(error, 'Failed to load users');
  }
}

async function handleCreateUser(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  if (hasUserManagementApiKey(request)) {
    return handleListUsers(request);
  }

  return withApiAuth(async ({ auth }) => {
    requireRole(auth, ['admin']);
    return handleListUsers(request);
  });
}

export async function POST(request: NextRequest) {
  if (hasUserManagementApiKey(request)) {
    return handleCreateUser(request);
  }

  return withApiAuth(async ({ auth }) => {
    requireRole(auth, ['admin']);
    return handleCreateUser(request);
  });
}

