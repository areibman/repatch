import path from "path";
import fs from "fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "@/remotion-webpack-override";
import { createClient } from "@/lib/supabase/server";
import { VideoData } from "@/types/patch-note";
import { Database } from "@/lib/supabase/database.types";

export type PatchNoteRecord =
  Database["public"]["Tables"]["patch_notes"]["Row"];

export interface RenderPatchNoteVideoOptions {
  patchNoteId: string;
  videoData?: VideoData | null;
  repoName?: string | null;
  force?: boolean;
}

export interface RenderPatchNoteVideoResult {
  videoUrl: string;
  reusedExisting: boolean;
  skipped?: boolean;
}

function buildVideoData(
  patchNote: PatchNoteRecord,
  override?: VideoData | null
): VideoData {
  const existing = (override || (patchNote.video_data as VideoData | null)) ?? {
    langCode: "en",
    topChanges: [],
    allChanges: [],
  };

  const aiSummaries = patchNote.ai_summaries as
    | Array<{
        sha: string;
        message: string;
        aiSummary: string;
        additions?: number;
        deletions?: number;
      }>
    | null
    | undefined;

  if (aiSummaries && Array.isArray(aiSummaries) && aiSummaries.length > 0) {
    const topChanges = aiSummaries.slice(0, 3).map((summary) => {
      const commitTitle = summary.message.split("\n")[0];
      const safeTitle =
        commitTitle.length > 60
          ? `${commitTitle.substring(0, 60)}...`
          : commitTitle;
      return {
        title: safeTitle,
        description: summary.aiSummary,
      };
    });

    const allChanges = aiSummaries.map((summary) => {
      const commitTitle = summary.message.split("\n")[0];
      const safeTitle =
        commitTitle.length > 50
          ? `${commitTitle.substring(0, 50)}...`
          : commitTitle;
      return `${safeTitle}: ${summary.aiSummary}`;
    });

    return {
      langCode: existing.langCode ?? "en",
      topChanges,
      allChanges,
    };
  }

  return existing;
}

function shouldSkipRender() {
  return (
    process.env.TYPEFULLY_SKIP_RENDER === "true" ||
    process.env.TYPEFULLY_MOCK_MODE === "true"
  );
}

export async function renderPatchNoteVideo({
  patchNoteId,
  videoData,
  repoName,
  force = false,
}: RenderPatchNoteVideoOptions): Promise<RenderPatchNoteVideoResult> {
  const supabase = await createClient();

  let patchNote: PatchNoteRecord | null = null;
  let fetchError: Error | null = null;

  try {
    const { data, error } = await supabase
      .from("patch_notes")
      .select("id, video_url, video_data, repo_name, ai_summaries")
      .eq("id", patchNoteId)
      .single();
    if (error || !data) {
      throw new Error(error?.message || "Missing patch note");
    }
    patchNote = data as PatchNoteRecord;
  } catch (error) {
    fetchError = error instanceof Error ? error : new Error(String(error));
  }

  if (!patchNote) {
    if (shouldSkipRender()) {
      const placeholderUrl = `/videos/mock-${patchNoteId}.mp4`;
      return { videoUrl: placeholderUrl, reusedExisting: false, skipped: true };
    }
    throw fetchError ?? new Error("Failed to load patch note for rendering");
  }

  if (!force && patchNote.video_url) {
    return { videoUrl: patchNote.video_url, reusedExisting: true };
  }

  const finalVideoData = buildVideoData(patchNote as PatchNoteRecord, videoData);

  if (shouldSkipRender()) {
    const placeholderUrl = `/videos/mock-${patchNoteId}.mp4`;
    try {
      await supabase
        .from("patch_notes")
        .update({ video_url: placeholderUrl })
        .eq("id", patchNoteId);
    } catch {
      // ignore in mock environments
    }
    return { videoUrl: placeholderUrl, reusedExisting: false, skipped: true };
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
      repositorySlug: patchNote.repo_name || repoName || "repository",
      releaseTag: "Latest Update",
      openaiGeneration: finalVideoData,
      ...finalVideoData,
    },
  });

  const outputDir = path.resolve(process.cwd(), "public", "videos");
  await fs.mkdir(outputDir, { recursive: true });

  const filename = `patch-note-${patchNoteId}-${Date.now()}.mp4`;
  const outputPath = path.join(outputDir, filename);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: {
      repositorySlug: patchNote.repo_name || repoName || "repository",
      releaseTag: "Latest Update",
      openaiGeneration: finalVideoData,
      ...finalVideoData,
    },
  });

  const videoUrl = `/videos/${filename}`;

  await supabase
    .from("patch_notes")
    .update({ video_url: videoUrl })
    .eq("id", patchNoteId);

  return { videoUrl, reusedExisting: false };
}
