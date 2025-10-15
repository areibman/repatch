import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { toApiKeySummary } from '@/lib/api-keys/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[api/admin/api-keys/:id] Failed to revoke key', error);
      return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({ key: toApiKeySummary(data) });
  } catch (error) {
    console.error('[api/admin/api-keys/:id] Unexpected failure', error);
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}
