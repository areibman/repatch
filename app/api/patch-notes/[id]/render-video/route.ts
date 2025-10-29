/**
 * Video Render API Route
 * Thin HTTP adapter for the video render service
 */

import { NextRequest, NextResponse } from "next/server";
import { renderVideo } from "@/lib/services";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

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
}

