import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderPatchNoteVideo } from "@/lib/remotion/renderPatchNoteVideo";
import type { RenderStrategy } from "@/lib/remotion/renderPatchNoteVideo";
import {
  getTypefullyConfig,
  queueThreadForPatchNote,
} from "@/lib/typefully";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    let includeVideo = true;
    try {
      const body = await request.json();
      includeVideo = body?.includeVideo ?? true;
    } catch {
      // ignore empty body
    }

    const { data: patchNote, error: patchNoteError } = await supabase
      .from("patch_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (patchNoteError || !patchNote) {
      return NextResponse.json(
        { error: "Patch note not found" },
        { status: 404 }
      );
    }

    const config = await getTypefullyConfig({ supabase });

    if (!config) {
      return NextResponse.json(
        {
          error:
            "Typefully is not configured. Connect the integration before queueing threads.",
        },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    let videoPath: string | null = null;

    if (includeVideo) {
      const renderStrategy = (process.env.TYPEFULLY_RENDER_STRATEGY as
        | RenderStrategy
        | undefined) ?? "remotion";

      const renderResult = await renderPatchNoteVideo({
        supabase,
        patchNoteId: patchNote.id,
        repoName: patchNote.repo_name,
        strategy: renderStrategy,
        reuseExisting: renderStrategy !== "mock",
      });

      videoPath = renderResult.outputPath;
    }

    const queueResult = await queueThreadForPatchNote({
      patchNote,
      supabase,
      config,
      appUrl,
      videoPath,
    });

    const { data: job, error: jobError } = await supabase
      .from("typefully_jobs")
      .insert({
        patch_note_id: patchNote.id,
        config_id: config.id,
        status: "queued",
        draft_id: queueResult.draftId,
        thread_id: queueResult.threadId,
        media_asset_id: queueResult.mediaAssetId,
        payload: queueResult.payload as unknown as Record<string, unknown>,
        response: queueResult.response as unknown as Record<string, unknown>,
      })
      .select("*")
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: jobError?.message ?? "Failed to record Typefully job" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "queued",
      threadId: queueResult.threadId,
      job,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to queue Typefully thread";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
