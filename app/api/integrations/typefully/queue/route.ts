import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createTypefullyDraft,
  formatPatchNoteAsThread,
  uploadTypefullyMedia,
} from "@/lib/typefully";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "@/remotion-webpack-override";
import path from "path";
import fs from "fs/promises";

// POST /api/integrations/typefully/queue - Queue a Twitter thread for a patch note
export async function POST(request: NextRequest) {
  try {
    const { patchNoteId, includeVideo } = await request.json();

    if (!patchNoteId) {
      return NextResponse.json(
        { error: "Patch note ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get Typefully API key
    const { data: config, error: configError } = await supabase
      .from("typefully_configs")
      .select("api_key")
      .limit(1)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: "Typefully is not configured. Please configure it first." },
        { status: 400 }
      );
    }

    // Get patch note
    const { data: patchNote, error: patchNoteError } = await supabase
      .from("patch_notes")
      .select("*")
      .eq("id", patchNoteId)
      .single();

    if (patchNoteError || !patchNote) {
      return NextResponse.json(
        { error: "Patch note not found" },
        { status: 404 }
      );
    }

    // Create a job record
    const { data: job, error: jobError } = await supabase
      .from("typefully_jobs")
      .insert({
        patch_note_id: patchNoteId,
        status: "pending",
        video_uploaded: false,
      })
      .select()
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 }
      );
    }

    let videoUrl = patchNote.video_url;
    let videoBuffer: Buffer | null = null;

    // Render video if requested and not already available
    if (includeVideo) {
      try {
        if (!videoUrl) {
          console.log("🎬 Rendering video for Typefully upload...");

          // Get AI summaries or video data
          let finalVideoData = patchNote.video_data;

          if (
            patchNote.ai_summaries &&
            Array.isArray(patchNote.ai_summaries) &&
            patchNote.ai_summaries.length > 0
          ) {
            console.log("✨ Using AI summaries for video generation");

            const aiSummaries = patchNote.ai_summaries as Array<{
              sha: string;
              message: string;
              aiSummary: string;
              additions: number;
              deletions: number;
            }>;

            const topChanges = aiSummaries.slice(0, 3).map((summary) => {
              const commitTitle = summary.message.split("\n")[0];
              return {
                title:
                  commitTitle.length > 60
                    ? commitTitle.substring(0, 60) + "..."
                    : commitTitle,
                description: summary.aiSummary,
              };
            });

            const allChanges = aiSummaries.map((summary) => {
              const commitTitle = summary.message.split("\n")[0];
              const shortTitle =
                commitTitle.length > 50
                  ? commitTitle.substring(0, 50) + "..."
                  : commitTitle;
              return `${shortTitle}: ${summary.aiSummary}`;
            });

            finalVideoData = {
              langCode: "en",
              topChanges,
              allChanges,
            };
          }

          // Bundle Remotion project
          const bundleLocation = await bundle(
            path.resolve(process.cwd(), "remotion/index.ts"),
            () => undefined,
            { webpackOverride }
          );

          // Select composition
          const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: "basecomp",
            inputProps: {
              repositorySlug: patchNote.repo_name,
              releaseTag: "Latest Update",
              openaiGeneration: finalVideoData,
              ...finalVideoData,
            },
          });

          // Create temp file for video
          const tempDir = path.resolve(process.cwd(), "tmp");
          await fs.mkdir(tempDir, { recursive: true });

          const tempFilename = `typefully-${patchNoteId}-${Date.now()}.mp4`;
          const tempPath = path.join(tempDir, tempFilename);

          // Render video
          await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: "h264",
            outputLocation: tempPath,
            inputProps: {
              repositorySlug: patchNote.repo_name,
              releaseTag: "Latest Update",
              openaiGeneration: finalVideoData,
              ...finalVideoData,
            },
          });

          // Read video file
          videoBuffer = await fs.readFile(tempPath);

          // Clean up temp file
          await fs.unlink(tempPath);

          console.log("✅ Video rendered successfully");
        } else {
          // Load existing video
          const videoPath = path.join(
            process.cwd(),
            "public",
            videoUrl.replace(/^\//, "")
          );
          videoBuffer = await fs.readFile(videoPath);
          console.log("✅ Using existing video");
        }

        // Upload video to Typefully
        if (videoBuffer) {
          console.log("📤 Uploading video to Typefully...");
          await uploadTypefullyMedia(
            config.api_key,
            videoBuffer,
            `patch-note-${patchNoteId}.mp4`
          );

          // Update job status
          await supabase
            .from("typefully_jobs")
            .update({ video_uploaded: true })
            .eq("id", job.id);

          console.log("✅ Video uploaded to Typefully");
        }
      } catch (videoError) {
        console.error("Video processing error:", videoError);
        // Continue without video
      }
    }

    // Format patch note as thread
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const fullVideoUrl = videoUrl ? `${baseUrl}${videoUrl}` : undefined;

    const threadContent = formatPatchNoteAsThread(
      patchNote.title,
      patchNote.content,
      patchNote.repo_name,
      fullVideoUrl
    );

    // Create draft on Typefully
    const draft = await createTypefullyDraft(config.api_key, {
      content: threadContent,
      threadify: true,
    });

    // Update job with thread ID and completion
    await supabase
      .from("typefully_jobs")
      .update({
        thread_id: draft.id,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return NextResponse.json({
      success: true,
      threadId: draft.id,
      jobId: job.id,
      message: "Twitter thread queued successfully",
    });
  } catch (error) {
    console.error("Error queueing Twitter thread:", error);

    // Try to update job status to failed
    try {
      const supabase = await createClient();
      const { patchNoteId } = await request.json();

      await supabase
        .from("typefully_jobs")
        .update({
          status: "failed",
          error_message:
            error instanceof Error ? error.message : "Unknown error",
        })
        .eq("patch_note_id", patchNoteId)
        .eq("status", "pending");
    } catch (updateError) {
      console.error("Failed to update job status:", updateError);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to queue Twitter thread",
      },
      { status: 500 }
    );
  }
}
