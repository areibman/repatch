import { NextRequest, NextResponse } from "next/server";
import { checkVideoRenderStatus } from "@/lib/remotion-lambda-renderer";

// Configure maximum duration for this route
// Just needs time to check Lambda render status
export const maxDuration = 30;

/**
 * GET /api/patch-notes/[id]/video-status
 * Checks the status of a video render job
 * Returns current progress and completion status
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    console.log('🔍 Checking video status for patch note:', id);

    // Check render status using centralized state machine
    const status = await checkVideoRenderStatus(id);

    console.log('📊 Video status:', status);

    return NextResponse.json(status);
  } catch (error) {
    console.error("❌ Error checking video status:", error);
    return NextResponse.json(
      {
        status: 'failed' as const,
        progress: 0,
        error: error instanceof Error ? error.message : "Failed to check video status"
      },
      { status: 500 }
    );
  }
}

