import { NextRequest, NextResponse } from "next/server";
import { startVideoRender } from "@/lib/remotion-lambda-renderer";
import { withApiAuth } from "@/lib/api/with-auth";

// Configure maximum duration for this route
// Just needs time to initiate Lambda render (not wait for completion)
export const maxDuration = 60;

// POST /api/patch-notes/[id]/regenerate-video - Regenerate video for a patch note
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async ({ supabase, auth }) => {
    try {
      const { id } = await context.params;

      console.log("🎬 Regenerating video for patch note:", id);

      const { data, error } = await supabase
        .from("patch_notes")
        .update({
          processing_status: "generating_video",
          processing_stage: "Preparing video render...",
          processing_error: null,
          video_url: null,
          video_render_id: null,
          video_bucket_name: null,
        })
        .eq("id", id)
        .eq("owner_id", auth.user.id)
        .select("id")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Patch note not found" },
          { status: 404 }
        );
      }

      const result = await startVideoRender(id);

      console.log("✅ Video render job initiated:", result);

      return NextResponse.json({
        success: true,
        renderId: result.renderId,
        bucketName: result.bucketName,
        message:
          "Video render started. Poll /video-status endpoint for progress.",
      });
    } catch (error) {
      console.error("Error regenerating video:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to regenerate video",
        },
        { status: 500 }
      );
    }
  });
}

