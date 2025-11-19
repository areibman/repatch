import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import {
  deleteManagedUser,
  getManagedUserById,
  updateManagedUser,
} from '@/lib/services';

import {
  ensureUserManagementAuthorized,
  handleServiceError,
} from '../helpers';

const userIdSchema = z.string().uuid();

function parseUserId(params: { id?: string }) {
  const result = userIdSchema.safeParse(params?.id);

  if (!result.success) {
    throw new Error('A valid user ID is required');
  }

  return result.data;
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const unauthorized = ensureUserManagementAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const userId = parseUserId(context.params);
    const user = await getManagedUserById(userId);
    return NextResponse.json(user);
  } catch (error) {
    return handleServiceError(error, 'Failed to load user');
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const unauthorized = ensureUserManagementAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const userId = parseUserId(context.params);
    const payload = await request.json();
    const updated = await updateManagedUser(userId, payload);
    return NextResponse.json(updated);
  } catch (error) {
    return handleServiceError(error, 'Failed to update user');
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const unauthorized = ensureUserManagementAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const userId = parseUserId(context.params);
    const result = await deleteManagedUser(userId);
    return NextResponse.json(result);
  } catch (error) {
    return handleServiceError(error, 'Failed to delete user');
  }
}

