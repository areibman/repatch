import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/lib/supabase/database.types';
import { generateTweetThread } from '@/lib/ai-summarizer';
import { createTypefullyDraft } from '@/lib/typefully';
import type { PatchNoteFilters } from '@/types/patch-note';

type PatchNoteRow = Database['public']['Tables']['patch_notes']['Row'];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!process.env.TYPEFULLY_API_KEY) {
      return NextResponse.json(
        { error: 'TYPEFULLY_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('patch_notes')
      .select(
        'id, title, content, repo_name, repo_url, filter_metadata, ai_overall_summary'
      )
      .eq('id', id)
      .single();

    const patchNote = data as PatchNoteRow | null;

    if (error || !patchNote) {
      return NextResponse.json(
        { error: 'Patch note not found' },
        { status: 404 }
      );
    }

    const filterMetadata = (patchNote?.filter_metadata ?? null) as
      | PatchNoteFilters
      | null;

    const thread = await generateTweetThread({
      title: patchNote.title,
      markdown: patchNote.content,
      repoName: patchNote.repo_name,
      repoUrl: patchNote.repo_url,
      filterMetadata,
      overallSummary: patchNote.ai_overall_summary,
    });

    const draft = await createTypefullyDraft({
      title: patchNote.title,
      thread,
      metadata: {
        patchNoteId: patchNote.id,
        repoName: patchNote.repo_name,
      },
    });

    return NextResponse.json({
      thread,
      draftId: draft.id ?? null,
      draftUrl: draft.url ?? draft.share_url ?? null,
      typefully: draft,
    });
  } catch (err) {
    console.error('Error creating Typefully draft:', err);
    const message = err instanceof Error ? err.message : 'Failed to create Typefully draft';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
