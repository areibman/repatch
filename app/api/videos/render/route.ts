import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderPatchNoteVideo } from '@/lib/remotion/render-patch-note-video';

export async function POST(request: NextRequest) {
  try {
    const { patchNoteId, videoData, repoName } = await request.json();

    console.log('🎬 VIDEO RENDER API CALLED');
    console.log('   - Patch Note ID:', patchNoteId);
    console.log('   - Repo Name:', repoName);
    console.log('   - Has videoData:', !!videoData);

    if (!patchNoteId) {
      console.error('❌ Missing patchNoteId!');
      return NextResponse.json(
        { error: 'Missing patchNoteId' },
        { status: 400 }
      );
    }

    console.log('✅ Starting video render for patch note:', patchNoteId);
    
    const supabase = await createClient();
    const renderResult = await renderPatchNoteVideo({
      supabase,
      patchNoteId,
      fallbackVideoData: videoData,
      repoName,
      persistToSupabase: true,
    });

    return NextResponse.json({
      success: true,
      videoUrl: renderResult.publicUrl,
      message: 'Video rendered successfully',
    });
  } catch (error) {
    console.error('Error rendering video:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to render video',
      },
      { status: 500 }
    );
  }
}

