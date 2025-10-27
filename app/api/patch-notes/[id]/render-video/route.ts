import { NextRequest, NextResponse } from "next/server";
import { startVideoRender } from "@/lib/remotion-lambda-renderer";

// Configure maximum duration for this route
// Just needs time to initiate Lambda render (not wait for completion)
export const maxDuration = 60;

/**
 * POST /api/patch-notes/[id]/render-video
 * Triggers video rendering on Remotion Lambda
 * Returns immediately with render job information
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    console.log('🎬 Triggering video render for patch note:', id);

    // Start the render (returns immediately, doesn't wait)
    const result = await startVideoRender(id);

    console.log('✅ Video render job initiated:', result);

    return NextResponse.json({
      success: true,
      renderId: result.renderId,
      bucketName: result.bucketName
    });
  } catch (error) {
    console.error("❌ Error starting video render:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start video render"
      },
      { status: 500 }
    );
  }
}

