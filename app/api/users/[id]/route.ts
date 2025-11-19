import { NextResponse } from 'next/server';
import {
  getUser,
  updateUser,
  deleteUser,
  updateUserInputSchema,
} from '@/lib/services';
import { ensureUserManagementAccess } from '../_lib/authorization';
import { handleUserApiError } from '../_lib/responses';

export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store',
};

export async function GET(request: Request) {
  const authError = ensureUserManagementAccess(request);
  if (authError) return authError;

  try {
    const user = await getUser(extractUserId(request.url));
    return NextResponse.json(user, {
      status: 200,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return handleUserApiError(error);
  }
}

export async function PATCH(request: Request) {
  const authError = ensureUserManagementAccess(request);
  if (authError) return authError;

  try {
    const payload = await request.json();
    const input = updateUserInputSchema.parse(payload);
    const user = await updateUser(extractUserId(request.url), input);

    return NextResponse.json(user, {
      status: 200,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return handleUserApiError(error);
  }
}

export async function DELETE(request: Request) {
  const authError = ensureUserManagementAccess(request);
  if (authError) return authError;

  try {
    const query = new URL(request.url).searchParams;
    const soft = query.get('soft') === 'true';

    const result = await deleteUser(extractUserId(request.url), { soft });
    return NextResponse.json(result, {
      status: 200,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return handleUserApiError(error);
  }
}

function extractUserId(url: string): string {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  return decodeURIComponent(segments[segments.length - 1] ?? '');
}
