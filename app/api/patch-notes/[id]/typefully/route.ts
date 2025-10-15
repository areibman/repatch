import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderPatchNoteVideo } from "@/lib/remotion/render-patch-note-video";
import {
  buildThreadPostsFromPatchNote,
  getActiveTypefullyConfig,
  queueTypefullyThread,
  uploadTypefullyVideo,
  type TypefullyJobRow,
} from "@/lib/typefully";

function resolveBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("typefully_jobs")
      .select("*")
      .eq("patch_note_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ job: data ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load Typefully job" },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let jobRecord: TypefullyJobRow | null = null;

  try {
    const { id } = await params;
    const supabase = await createClient();
    const config = await getActiveTypefullyConfig(supabase);

    if (!config) {
      return NextResponse.json(
        { error: "Typefully is not configured" },
        { status: 400 }
      );
    }

    const { data: patchNote, error: patchNoteError } = await supabase
      .from("patch_notes")
      .select(
        "id, title, content, repo_name, repo_url, video_url, video_data, ai_summaries"
      )
      .eq("id", id)
      .single();

    if (patchNoteError || !patchNote) {
      return NextResponse.json(
        { error: "Patch note not found" },
        { status: 404 }
      );
    }

    const patchNoteUrl = `${resolveBaseUrl()}/blog/${id}`;

    const renderResult = await renderPatchNoteVideo({
      supabase,
      patchNoteId: id,
      fallbackVideoData: patchNote.video_data as any,
      repoName: patchNote.repo_name,
      persistToSupabase: true,
    });

    const posts = buildThreadPostsFromPatchNote(patchNote, {
      patchNoteUrl,
      videoUrl: `${resolveBaseUrl()}${renderResult.publicUrl}`,
    });

    const insertResult = await supabase
      .from("typefully_jobs")
      .insert({
        patch_note_id: id,
        typefully_config_id: config.id,
        status: "rendered",
        video_url: renderResult.publicUrl,
        payload: { posts, patchNoteUrl },
      })
      .select()
      .single();

    if (insertResult.error) {
      return NextResponse.json(
        { error: insertResult.error.message },
        { status: 500 }
      );
    }

    jobRecord = insertResult.data;

    const uploadResult = await uploadTypefullyVideo(config, renderResult.videoBuffer, {
      filename: `patch-note-${id}.mp4`,
      contentType: "video/mp4",
    });

    const postsWithMedia = posts.map((post, index) => ({
      ...post,
      mediaId: index === 0 ? uploadResult.mediaId : post.mediaId ?? null,
    }));

    const uploadUpdate = await supabase
      .from("typefully_jobs")
      .update({
        status: "uploading",
        payload: {
          posts: postsWithMedia,
          patchNoteUrl,
          mediaId: uploadResult.mediaId,
        },
        response: { upload: uploadResult.raw },
      })
      .eq("id", jobRecord.id)
      .select()
      .single();

    if (uploadUpdate.error) {
      throw new Error(uploadUpdate.error.message);
    }

    jobRecord = uploadUpdate.data;

    const queueResponse = await queueTypefullyThread(config, {
      posts: postsWithMedia,
      mediaId: uploadResult.mediaId,
      patchNoteUrl,
    });

    const finalUpdate = await supabase
      .from("typefully_jobs")
      .update({
        status: queueResponse.state || "queued",
        thread_id: queueResponse.thread?.id || queueResponse.id || null,
        response: { upload: uploadResult.raw, queue: queueResponse },
        payload: {
          posts: postsWithMedia,
          patchNoteUrl,
          mediaId: uploadResult.mediaId,
        },
      })
      .eq("id", jobRecord.id)
      .select()
      .single();

    if (finalUpdate.error) {
      throw new Error(finalUpdate.error.message);
    }

    jobRecord = finalUpdate.data;

    return NextResponse.json({ job: jobRecord });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to queue thread";

    if (jobRecord) {
      const supabase = await createClient();
      await supabase
        .from("typefully_jobs")
        .update({ status: "failed", error: message })
        .eq("id", jobRecord.id);
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
