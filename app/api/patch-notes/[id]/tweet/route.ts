import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTweetThread } from '@/lib/ai-summarizer';
import { createTypefullyDraft } from '@/lib/typefully';

interface PatchNoteRow {
  id: string;
  title: string;
  content: string;
  repo_name: string;
  ai_overall_summary: string | null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const { data: patchNote, error } = await supabase
      .from('patch_notes')
      .select('id, title, content, repo_name, ai_overall_summary')
      .eq('id', id)
      .single<PatchNoteRow>();

    if (error || !patchNote) {
      return NextResponse.json(
        { error: 'Patch note not found.' },
        { status: 404 }
      );
    }

    if (!process.env.TYPEFULLY_API_KEY) {
      return NextResponse.json(
        { error: 'TYPEFULLY_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const tweets = await generateTweetThread({
      title: patchNote.title,
      repoName: patchNote.repo_name,
      summary: patchNote.ai_overall_summary,
      content: patchNote.content,
    });

    if (tweets.length === 0) {
      return NextResponse.json(
        { error: 'Unable to generate tweet thread.' },
        { status: 500 }
      );
    }

    const draftResponse = await createTypefullyDraft({
      tweets,
      title: `${patchNote.repo_name} updates: ${patchNote.title}`.slice(0, 60),
    });

    return NextResponse.json({
      success: true,
      tweets,
      draft: draftResponse,
    });
  } catch (error) {
    console.error('Error creating Typefully draft:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create thread draft.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
