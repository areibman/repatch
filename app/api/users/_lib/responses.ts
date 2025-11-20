import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { UserManagementError } from '@/lib/services';

export function handleUserApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        issues: error.flatten(),
      },
      { status: 400 }
    );
  }

  if (error instanceof UserManagementError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }

  console.error('[user-management] Unexpected error', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
