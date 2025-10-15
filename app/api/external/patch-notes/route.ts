import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizePatchNote } from '@/lib/patch-notes/sanitizer';
import { recordApiKeyUsage } from '@/lib/api-keys/activity';

function normalizeLimit(value: string | null) {
  const parsed = Number(value ?? '');
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }
  return Math.min(parsed, 50);
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;
    const limit = normalizeLimit(searchParams.get('limit'));
    const repo = searchParams.get('repo');
    const since = normalizeDate(searchParams.get('since'));

    let query = supabase
      .from('patch_notes')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (repo) {
      query = query.eq('repo_name', repo);
    }

    if (since) {
      query = query.gte('generated_at', since);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[api/external/patch-notes] Failed to fetch patch notes', error);
      return NextResponse.json(
        { error: 'Failed to load patch notes' },
        { status: 500 }
      );
    }

    const apiKeyId = request.headers.get('x-api-key-id');
    if (apiKeyId) {
      void recordApiKeyUsage(apiKeyId);
    }

    const body = {
      patchNotes: (data ?? []).map(sanitizePatchNote),
    };

    const headers = new Headers();
    const limitHeader = request.headers.get('x-rate-limit-limit');
    const remainingHeader = request.headers.get('x-rate-limit-remaining');
    const resetHeader = request.headers.get('x-rate-limit-reset');

    if (limitHeader) headers.set('X-Rate-Limit-Limit', limitHeader);
    if (remainingHeader) headers.set('X-Rate-Limit-Remaining', remainingHeader);
    if (resetHeader) headers.set('X-Rate-Limit-Reset', resetHeader);

    return NextResponse.json(body, { headers });
  } catch (error) {
    console.error('[api/external/patch-notes] Unexpected failure', error);
    return NextResponse.json({ error: 'Failed to load patch notes' }, { status: 500 });
  }
}
