import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sanitizePatchNote } from '@/lib/external/sanitizers';

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
        { error: 'Failed to load patch notes' },
        { status: 500 }
      );
    }

    const sanitized = (data ?? []).map(sanitizePatchNote);

    return NextResponse.json({ data: sanitized });
  } catch (error) {
    console.error('External patch note fetch failed', error);
    return NextResponse.json(
      { error: 'Unexpected error retrieving patch notes' },
      { status: 500 }
    );
  }
}
