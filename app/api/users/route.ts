import { NextResponse } from 'next/server';
import {
  listUsers,
  createUser,
  listUsersInputSchema,
  createUserInputSchema,
} from '@/lib/services';
import { ensureUserManagementAccess } from './_lib/authorization';
import { handleUserApiError } from './_lib/responses';

export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store',
};

export async function GET(request: Request) {
  const authError = ensureUserManagementAccess(request);
  if (authError) return authError;

  try {
    const params = new URL(request.url).searchParams;
    const input = listUsersInputSchema.parse({
      page: params.get('page') ?? undefined,
      perPage: params.get('perPage') ?? undefined,
      query: params.get('query') ?? undefined,
      includeInvited: params.get('includeInvited') ?? undefined,
      includeBanned: params.get('includeBanned') ?? undefined,
    });

    const data = await listUsers(input);
    return NextResponse.json(data, {
      status: 200,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return handleUserApiError(error);
  }
}

export async function POST(request: Request) {
  const authError = ensureUserManagementAccess(request);
  if (authError) return authError;

  try {
    const payload = await request.json();
    const input = createUserInputSchema.parse(payload);
    const data = await createUser(input);

    return NextResponse.json(data, {
      status: 201,
      headers: noStoreHeaders,
    });
  } catch (error) {
    return handleUserApiError(error);
  }
}
