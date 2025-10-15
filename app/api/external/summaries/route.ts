import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sanitizePatchNote, toSummaryPayload } from '@/lib/external/sanitizers';

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('patch_notes')
      .select(
        'id, repo_name, repo_url, title, time_period, generated_at, changes, ai_overall_summary, ai_summaries'
      )
      .order('generated_at', { ascending: false })
      .limit(25);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load summaries' },
        { status: 500 }
      );
    }

    const payload = (data ?? []).map((row) => toSummaryPayload(sanitizePatchNote(row)));

    return NextResponse.json({ data: payload });
  } catch (error) {
    console.error('External summary fetch failed', error);
    return NextResponse.json(
      { error: 'Unexpected error retrieving summaries' },
      { status: 500 }
    );
  }
}
