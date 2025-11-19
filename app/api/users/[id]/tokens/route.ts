import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  createApiToken,
  type ServiceResult,
} from '@/lib/services/user-management.service';

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    typeof (payload as Record<string, unknown>).name !== 'string'
  ) {
    return NextResponse.json({ error: 'Token name is required' }, { status: 400 });
  }

  const result = await createApiToken(actor.userId, {
    ...(payload as Record<string, never>),
    userId: params.id,
  });

  return fromServiceResult(result, 201);
}
