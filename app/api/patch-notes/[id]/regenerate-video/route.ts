import { NextRequest, NextResponse } from "next/server";
import { renderPatchNoteVideoOnLambda } from "@/lib/remotion-lambda-renderer";

// POST /api/patch-notes/[id]/regenerate-video - Regenerate video for a patch note
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const { videoData, repoName } = body;

    if (!videoData || !repoName) {
      return NextResponse.json(
        { error: "Missing required fields: videoData, repoName" },
        { status: 400 }
      );
    }

    console.log('🎬 Regenerating video on Lambda...');
    console.log('   - Patch Note ID:', id);
    console.log('   - Repo:', repoName);

    // Call the Lambda render function
    const result = await renderPatchNoteVideoOnLambda(id, videoData, repoName);

    console.log('✅ Lambda video regeneration completed:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error regenerating video:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to regenerate video",
      },
      { status: 500 }
    );
  }
}

