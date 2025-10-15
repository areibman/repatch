import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { composeThread, getTypefullyConfig, queueThread } from "@/lib/typefully";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const includeVideo = Boolean(body?.includeVideo);

    const supabase = await createClient();

    // Fetch the patch note
    const { data: patchNote, error: fetchError } = await supabase
      .from("patch_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !patchNote) {
      return NextResponse.json(
        { error: "Patch note not found" },
        { status: 404 }
      );
    }

    // Resolve base URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    // Optionally render video first
    let videoUrl: string | null = patchNote.video_url;
    if (includeVideo && !videoUrl) {
      const renderRes = await fetch(`${baseUrl}/api/videos/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patchNoteId: id,
          videoData: patchNote.video_data,
          repoName: patchNote.repo_name,
        }),
      });
      if (renderRes.ok) {
        const renderData = await renderRes.json();
        videoUrl = renderData.videoUrl || null;
      }
    }

    // Compose thread
    const posts = composeThread({
      title: patchNote.title,
      repoName: patchNote.repo_name,
      repoUrl: patchNote.repo_url,
      content: patchNote.content,
      changes: patchNote.changes as any,
      contributors: patchNote.contributors as any,
      patchNoteId: id,
      baseUrl,
      videoUrl,
    });

    // Load config
    const config = await getTypefullyConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Typefully is not configured" },
        { status: 400 }
      );
    }

    // Create job row (queued)
    const { data: job, error: jobErr } = await supabase
      .from("typefully_jobs")
      .insert({
        patch_note_id: id,
        status: "queued",
        video_url: videoUrl,
        request_payload: { posts },
      })
      .select("id")
      .single();

    if (jobErr) {
      return NextResponse.json({ error: jobErr.message }, { status: 500 });
    }

    // Queue thread
    const result = await queueThread({ config, posts });

    // Update job status
    await supabase
      .from("typefully_jobs")
      .update({
        status: result.ok ? "succeeded" : "failed",
        thread_id: result.threadId || null,
        response_payload: result.response || (result.error ? { error: result.error } : null),
      })
      .eq("id", job.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Failed to queue" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, threadId: result.threadId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to queue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
