import { NextRequest, NextResponse } from "next/server";
import { startVideoRender } from "@/lib/remotion-lambda-renderer";
import { transitionVideoRenderState } from "@/lib/services/video-render-state.service";

// Configure maximum duration for this route
// Just needs time to initiate Lambda render (not wait for completion)
export const maxDuration = 60;

// POST /api/patch-notes/[id]/regenerate-video - Regenerate video for a patch note
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    console.log('🎬 Regenerating video for patch note:', id);

    // Reset state to idle first (clears old video and render tracking)
    // This allows retrying from failed state or regenerating completed videos
    await transitionVideoRenderState(id, 'idle', {
      videoUrl: null,
      renderId: null,
      bucketName: null,
      stage: 'Preparing video render...',
    });

    // Start the render (returns immediately, doesn't wait)
    // The startVideoRender function will transition to initiating -> rendering
    const result = await startVideoRender(id);

    console.log('✅ Video render job initiated:', result);

    return NextResponse.json({
      success: true,
      renderId: result.renderId,
      bucketName: result.bucketName,
      message: "Video render started. Connect to /video-status-stream for real-time updates."
    });
  } catch (error) {
    console.error("Error regenerating video:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to regenerate video"
      },
      { status: 500 }
    );
  }
}

