import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import {
  getManagedUserById,
  updateManagedUser,
  deleteManagedUser,
  updateUserSchema,
  UserManagementError,
} from '@/lib/services';

type RouteContext = {
  params: { id: string };
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getManagedUserById(context.params.id);
    return NextResponse.json(user);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const body = await request.json();
    const input = updateUserSchema.parse(body);
    const user = await updateManagedUser(context.params.id, input);

    return NextResponse.json(user);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    await deleteManagedUser(context.params.id);
    return new NextResponse(null, { status: 204 });
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
