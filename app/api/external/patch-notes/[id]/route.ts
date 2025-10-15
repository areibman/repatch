import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sanitizePatchNote } from '@/lib/external/sanitizers';

type Params = {
  params: { id: string };
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('patch_notes')
      .select(
        'id, repo_name, repo_url, title, time_period, generated_at, changes, ai_overall_summary, ai_summaries'
      )
      .eq('id', params.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load patch note' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: 'Patch note not found' }, { status: 404 });
    }

    return NextResponse.json({ data: sanitizePatchNote(data) });
  } catch (error) {
    console.error('External patch note fetch failed', error);
    return NextResponse.json(
      { error: 'Unexpected error retrieving patch note' },
      { status: 500 }
    );
  }
}
