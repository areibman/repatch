import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  revokeApiToken,
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

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; tokenId: string } }
) {
  const actor = await resolveActorId();
  if (actor instanceof NextResponse) return actor;

  const result = await revokeApiToken(actor.userId, params.id, params.tokenId);
  return fromServiceResult(result);
}
