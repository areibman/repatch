import path from "path";
import fs from "fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { webpackOverride } from "@/remotion-webpack-override";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { VideoData } from "@/types/patch-note";
import {
  deriveVideoDataFromSummaries,
  parseVideoData,
} from "@/lib/typefully";

const DEFAULT_VIDEO_DATA: VideoData = {
  langCode: "en",
  topChanges: [
    {
      title: "New features shipped",
      description: "Highlights from this release",
    },
  ],
  allChanges: ["New features shipped"],
};

const MOCK_VIDEO_BUFFER = Buffer.from("Typefully mock video content");

function shouldMockRender(): boolean {
  return (
    process.env.PATCH_NOTES_VIDEO_RENDER_MODE === "mock" ||
    process.env.TYPEFULLY_API_MOCK === "true" ||
    process.env.TYPEFULLY_VIDEO_RENDER_MODE === "mock"
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

export type RenderPatchNoteVideoOptions = {
  supabase: SupabaseClient<Database>;
  patchNoteId: string;
  fallbackVideoData?: VideoData | null;
  repoName?: string | null;
  persistToSupabase?: boolean;
};

export type RenderPatchNoteVideoResult = {
  videoPath: string;
  publicUrl: string;
  videoBuffer: Buffer;
  videoData: VideoData;
};

async function ensureOutputPath(filename: string) {
  const outputDir = path.resolve(process.cwd(), "public", "videos");
  await fs.mkdir(outputDir, { recursive: true });
  return path.join(outputDir, filename);
}

async function updateVideoUrl(
  supabase: SupabaseClient<Database>,
  patchNoteId: string,
  videoUrl: string
) {
  const { error } = await supabase
    .from("patch_notes")
    .update({ video_url: videoUrl, updated_at: nowIso() })
    .eq("id", patchNoteId);

  if (error) {
    console.error("Failed to persist rendered video URL", error);
  }
}

export async function renderPatchNoteVideo(
  options: RenderPatchNoteVideoOptions
): Promise<RenderPatchNoteVideoResult> {
  const { supabase, patchNoteId } = options;
  const { data: patchNote, error } = await supabase
    .from("patch_notes")
    .select("id, repo_name, video_data, ai_summaries, video_url")
    .eq("id", patchNoteId)
    .single();

  if (error || !patchNote) {
    throw new Error("Patch note not found for rendering");
  }

  let videoData =
    deriveVideoDataFromSummaries(patchNote.ai_summaries as Json | null) ||
    parseVideoData(patchNote.video_data as Json | null) ||
    options.fallbackVideoData ||
    DEFAULT_VIDEO_DATA;

  const filename = `patch-note-${patchNoteId}-${Date.now()}.mp4`;
  const outputPath = await ensureOutputPath(filename);
  const publicUrl = `/videos/${filename}`;

  if (shouldMockRender()) {
    await fs.writeFile(outputPath, MOCK_VIDEO_BUFFER);
    if (options.persistToSupabase !== false) {
      await updateVideoUrl(supabase, patchNoteId, publicUrl);
    }
    return {
      videoPath: outputPath,
      publicUrl,
      videoBuffer: MOCK_VIDEO_BUFFER,
      videoData,
    };
  }

  const bundleLocation = await bundle(
    path.resolve(process.cwd(), "remotion/index.ts"),
    () => undefined,
    {
      webpackOverride,
    }
  );

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "basecomp",
    inputProps: {
      repositorySlug: patchNote.repo_name || options.repoName || "repository",
      releaseTag: "Latest Update",
      openaiGeneration: videoData,
      ...videoData,
    },
  });

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: {
      repositorySlug: patchNote.repo_name || options.repoName || "repository",
      releaseTag: "Latest Update",
      openaiGeneration: videoData,
      ...videoData,
    },
  });

  const videoBuffer = await fs.readFile(outputPath);

  if (options.persistToSupabase !== false) {
    await updateVideoUrl(supabase, patchNoteId, publicUrl);
  }

  return {
    videoPath: outputPath,
    publicUrl,
    videoBuffer,
    videoData,
  };
}
