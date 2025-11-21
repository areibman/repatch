import { NextRequest, NextResponse } from "next/server";
import { getVideoRenderStatus } from "@/lib/remotion-lambda-renderer";
import { withApiAuth } from "@/lib/api/with-auth";

// Configure maximum duration for this route
// Just needs time to check Lambda render status
export const maxDuration = 30;

/**
 * GET /api/patch-notes/[id]/video-status
 * Checks the status of a video render job
 * Returns current progress and completion status
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async ({ supabase, auth }) => {
    try {
      const { id } = await context.params;

      console.log("🔍 Checking video status for patch note:", id);

      const { data, error } = await supabase
        .from("patch_notes")
        .select("id")
        .eq("id", id)
        .eq("owner_id", auth.user.id)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Patch note not found" },
          { status: 404 }
        );
      }

      const status = await getVideoRenderStatus(id);

      console.log("📊 Video status:", status);

      return NextResponse.json(status);
    } catch (error) {
      console.error("❌ Error checking video status:", error);
      return NextResponse.json(
        {
          status: "failed" as const,
          progress: 0,
          error:
            error instanceof Error
              ? error.message
              : "Failed to check video status",
        },
        { status: 500 }
      );
    }
  });
}

