import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import {
  listManagedUsers,
  createManagedUser,
  listUsersQuerySchema,
  createUserSchema,
  UserManagementError,
} from '@/lib/services';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = listUsersQuerySchema.parse({
      page: searchParams.get('page') ?? undefined,
      perPage: searchParams.get('perPage') ?? undefined,
      email: searchParams.get('email') ?? undefined,
      role: searchParams.get('role') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    });

    const payload = await listManagedUsers(query);
    return NextResponse.json(payload);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createUserSchema.parse(body);
    const user = await createManagedUser(input);

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Invalid request payload',
        details: error.flatten(),
      },
      { status: 400 }
    );
  }

  if (error instanceof UserManagementError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error('[UserManagement API] Unexpected error', error);
  return NextResponse.json(
    { error: 'Unexpected error while processing request' },
    { status: 500 }
  );
}
