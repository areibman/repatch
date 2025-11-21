/**
 * Video Render API Route
 * Thin HTTP adapter for the video render service
 */

import { NextRequest, NextResponse } from "next/server";
import { renderVideo } from "@/lib/services";
import { withApiAuth } from "@/lib/api/with-auth";

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async ({ supabase, auth }) => {
    const { id } = await context.params;

    const { data, error } = await supabase
      .from("patch_notes")
      .select("id")
      .eq("id", id)
      .eq("owner_id", auth.user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Patch note not found" }, { status: 404 });
    }

    const result = await renderVideo({ patchNoteId: id });

    return result.success
      ? NextResponse.json({
          success: true,
          renderId: result.data.renderId,
          bucketName: result.data.bucketName,
        })
      : NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
  });
}

