import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  listUsers,
  createUser,
  type ServiceResult,
} from '@/lib/services/user-management.service';
import type { ListUsersFilters, UserRole, UserStatus } from '@/types/user';

const ROLE_VALUES: readonly UserRole[] = ['admin', 'manager', 'editor', 'viewer', 'service'];
const STATUS_VALUES: readonly UserStatus[] = ['invited', 'active', 'suspended', 'deactivated'];

async function resolveActorId(): Promise<{ userId: string } | NextResponse> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return { userId: data.user.id };
}

function fromServiceResult<T>(
  result: ServiceResult<T>,
  successStatus = 200
): NextResponse {
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json(result.data, { status: successStatus });
}

function parseListFilters(request: NextRequest): ListUsersFilters {
  const url = new URL(request.url);
  const search = url.searchParams.get('search') ?? undefined;

  const roles = url
    .searchParams
    .getAll('role')
    .filter((role): role is UserRole => (ROLE_VALUES as readonly string[]).includes(role));

  const statuses = url
    .searchParams
    .getAll('status')
    .filter((status): status is UserStatus => (STATUS_VALUES as readonly string[]).includes(status));

  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');

  return {
    search,
    roles: roles.length ? roles : undefined,
    statuses: statuses.length ? statuses : undefined,
    limit: limitParam ? Number(limitParam) : undefined,
    offset: offsetParam ? Number(offsetParam) : undefined,
  };
}

export async function GET(request: NextRequest) {
  const actor = await resolveActorId();
  if (actor instanceof NextResponse) return actor;

  const filters = parseListFilters(request);
  const result = await listUsers(actor.userId, filters);

  return fromServiceResult(result);
}

export async function POST(request: NextRequest) {
  const actor = await resolveActorId();
  if (actor instanceof NextResponse) return actor;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof (payload as Record<string, unknown>).email !== 'string'
  ) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const result = await createUser(actor.userId, payload as Record<string, never>);
  return fromServiceResult(result, 201);
}
