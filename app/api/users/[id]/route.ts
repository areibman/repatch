import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import {
  deleteManagedUser,
  getManagedUserById,
  updateManagedUser,
} from '@/lib/services';

import {
  hasUserManagementApiKey,
  handleServiceError,
} from '../helpers';
import { withApiAuth } from '@/lib/api/with-auth';
import { requireRole } from '@/lib/supabase';

const userIdSchema = z.string().uuid();

function parseUserId(params: { id?: string }) {
  const result = userIdSchema.safeParse(params?.id);

  if (!result.success) {
    throw new Error('A valid user ID is required');
  }

  return result.data;
}

async function authorizeRequest(
  request: NextRequest,
  handler: () => Promise<NextResponse>
) {
  if (hasUserManagementApiKey(request)) {
    return handler();
  }

  return withApiAuth(async ({ auth }) => {
    requireRole(auth, ['admin']);
    return handler();
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return authorizeRequest(request, async () => {
    try {
      const userId = parseUserId({ id });
      const user = await getManagedUserById(userId);
      return NextResponse.json(user);
    } catch (error) {
      return handleServiceError(error, 'Failed to load user');
    }
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return authorizeRequest(request, async () => {
    try {
      const userId = parseUserId({ id });
      const payload = await request.json();
      const updated = await updateManagedUser(userId, payload);
      return NextResponse.json(updated);
    } catch (error) {
      return handleServiceError(error, 'Failed to update user');
    }
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return authorizeRequest(request, async () => {
    try {
      const userId = parseUserId({ id });
      const result = await deleteManagedUser(userId);
      return NextResponse.json(result);
    } catch (error) {
      return handleServiceError(error, 'Failed to delete user');
    }
  });
}

