import { NextRequest, NextResponse } from "next/server";
import { startVideoRender } from "@/lib/remotion-lambda-renderer";
import { resetVideoRender } from "@/lib/services/video-render-state-machine";
import { cookies } from "next/headers";

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

    // Reset video render state using state machine
    await resetVideoRender(id);

    // Start the render (returns immediately, doesn't wait)
    // This will transition to generating_video state
    const result = await startVideoRender(id);

    console.log('✅ Video render job initiated:', result);

    return NextResponse.json({
      success: true,
      renderId: result.renderId,
      bucketName: result.bucketName,
      message: "Video render started. Poll /video-status endpoint for progress."
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

