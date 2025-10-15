import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { queueThread } from '@/lib/typefully';

export async function POST(request: NextRequest) {
  try {
    const { patchNoteId, attachVideo } = await request.json();
    if (!patchNoteId) {
      return NextResponse.json({ error: 'Missing patchNoteId' }, { status: 400 });
    }

    const supabase = await createClient();
    // Fetch patch note
    const { data: patchNote, error: fetchError } = await supabase
      .from('patch_notes')
      .select('*')
      .eq('id', patchNoteId)
      .single();

    if (fetchError || !patchNote) {
      return NextResponse.json({ error: 'Patch note not found' }, { status: 404 });
    }

    // Compose thread text from title and content (truncate)
    const maxLen = 2500; // rough cap for Typefully thread input
    const baseText = `🧵 ${patchNote.title}\n\n` + String(patchNote.content || '').slice(0, maxLen);

    let videoUrl = attachVideo ? (patchNote.video_url as string | null) : null;

    // If video attachment requested but missing, render it now via existing API
    if (attachVideo && !videoUrl) {
      const origin = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
      const renderRes = await fetch(`${origin}/api/videos/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patchNoteId,
          videoData: patchNote.video_data,
          repoName: patchNote.repo_name,
        }),
      });
      if (renderRes.ok) {
        const payload = await renderRes.json();
        if (payload.videoUrl) {
          videoUrl = payload.videoUrl as string;
        }
      }
    }

    // Optionally load a stored API key (take the most recent)
    const { data: cfg } = await supabase
      .from('typefully_configs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const result = await queueThread({
      text: baseText,
      mediaUrl: videoUrl || undefined,
      apiKey: cfg?.api_key,
    });

    // Record job
    const { error: jobError } = await supabase.from('typefully_jobs').insert({
      patch_note_id: patchNoteId,
      status: result.ok ? 'sent' : 'failed',
      thread_id: result.threadId || null,
      video_url: videoUrl || null,
      error: result.ok ? null : result.error || 'unknown',
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Failed to queue thread' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, threadId: result.threadId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
