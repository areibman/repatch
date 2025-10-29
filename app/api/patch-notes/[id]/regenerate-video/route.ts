import { NextRequest, NextResponse } from "next/server";
import { startVideoRender } from "@/lib/remotion-lambda-renderer";
import { failVideoRender } from "@/lib/services/video-render-state.service";

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

    // Start the render (returns immediately, doesn't wait)
    // The render function will handle state transitions via the state machine
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
    const errorMessage = error instanceof Error ? error.message : "Failed to regenerate video";
    
    // Use state machine to fail the render
    try {
      await failVideoRender(id, errorMessage);
    } catch (stateError) {
      console.error("Failed to update state:", stateError);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

