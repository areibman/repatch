import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizePatchNote } from '@/lib/patch-notes/sanitizer';
import { recordApiKeyUsage } from '@/lib/api-keys/activity';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('patch_notes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[api/external/patch-notes/:id] Failed to fetch patch note', error);
      return NextResponse.json({ error: 'Patch note not found' }, { status: 404 });
    }

    const apiKeyId = request.headers.get('x-api-key-id');
    if (apiKeyId) {
      void recordApiKeyUsage(apiKeyId);
    }

    const headers = new Headers();
    const limitHeader = request.headers.get('x-rate-limit-limit');
    const remainingHeader = request.headers.get('x-rate-limit-remaining');
    const resetHeader = request.headers.get('x-rate-limit-reset');

    if (limitHeader) headers.set('X-Rate-Limit-Limit', limitHeader);
    if (remainingHeader) headers.set('X-Rate-Limit-Remaining', remainingHeader);
    if (resetHeader) headers.set('X-Rate-Limit-Reset', resetHeader);

    return NextResponse.json({ patchNote: sanitizePatchNote(data) }, { headers });
  } catch (error) {
    console.error('[api/external/patch-notes/:id] Unexpected failure', error);
    return NextResponse.json({ error: 'Failed to load patch note' }, { status: 500 });
  }
}
