import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderPatchNoteVideo } from '@/lib/remotion/renderPatchNoteVideo';

export async function POST(request: NextRequest) {
  try {
    const { patchNoteId, videoData, repoName } = await request.json();

    if (!patchNoteId) {
      return NextResponse.json(
        { error: 'Missing patchNoteId' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await renderPatchNoteVideo({
      supabase,
      patchNoteId,
      repoName,
      overrideVideoData: videoData,
      strategy: "remotion",
      reuseExisting: false,
    });

    return NextResponse.json({
      success: true,
      videoUrl: result.videoUrl,
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

