import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { generateApiKeyToken, toApiKeySummary } from '@/lib/api-keys/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceRoleClient();
    const { token, hashedToken, tokenPrefix, tokenLastFour } = generateApiKeyToken();

    const { data, error } = await supabase
      .from('api_keys')
      .update({
        hashed_token: hashedToken,
        token_prefix: tokenPrefix,
        token_last_four: tokenLastFour,
        rotated_at: new Date().toISOString(),
        revoked_at: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[api/admin/api-keys/:id/rotate] Failed to rotate key', error);
      return NextResponse.json({ error: 'Failed to rotate API key' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({ key: toApiKeySummary(data), token });
  } catch (error) {
    console.error('[api/admin/api-keys/:id/rotate] Unexpected failure', error);
    return NextResponse.json({ error: 'Failed to rotate API key' }, { status: 500 });
  }
}
