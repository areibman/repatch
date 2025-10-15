import { NextRequest, NextResponse } from 'next/server';
import {
  renderPatchNoteVideo,
  RenderPatchNoteVideoOptions,
} from '@/lib/videos/render';

export async function POST(request: NextRequest) {
  try {
    const { patchNoteId, videoData, repoName, force } =
      (await request.json()) as RenderPatchNoteVideoOptions & {
        force?: boolean;
      };

    if (!patchNoteId) {
      return NextResponse.json(
        { error: 'Missing patchNoteId' },
        { status: 400 }
      );
    }

    const result = await renderPatchNoteVideo({
      patchNoteId,
      videoData,
      repoName,
      force,
    });

    return NextResponse.json({
      success: true,
      videoUrl: result.videoUrl,
      reusedExisting: result.reusedExisting,
      skipped: result.skipped ?? false,
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

