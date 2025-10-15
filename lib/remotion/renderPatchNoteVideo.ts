import path from "path";
import fs from "fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { webpackOverride } from "@/remotion-webpack-override";
import type { Database, Json } from "@/lib/supabase/database.types";

export type RenderStrategy = "remotion" | "mock";

export type RenderPatchNoteVideoOptions = {
  supabase: SupabaseClient<Database>;
  patchNoteId: string;
  repoName?: string | null;
  overrideVideoData?: Json | null;
  strategy?: RenderStrategy;
  reuseExisting?: boolean;
  mockBuffer?: Buffer;
};

export type RenderPatchNoteVideoResult = {
  videoUrl: string | null;
  outputPath: string;
  usedExisting: boolean;
  strategy: RenderStrategy;
};

export async function renderPatchNoteVideo({
  supabase,
  patchNoteId,
  repoName,
  overrideVideoData,
  strategy = "remotion",
  reuseExisting = true,
  mockBuffer,
}: RenderPatchNoteVideoOptions): Promise<RenderPatchNoteVideoResult> {
  const { data: patchNote, error } = await supabase
    .from("patch_notes")
    .select("ai_summaries, video_data, repo_name, video_url")
    .eq("id", patchNoteId)
    .single();

  if (error || !patchNote) {
    throw new Error("Failed to fetch patch note for rendering");
  }

  const resolvedRepoName = repoName ?? patchNote.repo_name ?? "repository";

  if (reuseExisting && patchNote.video_url) {
    const existingPath = path.resolve(
      process.cwd(),
      "public",
      patchNote.video_url.replace(/^\//, "")
    );

    try {
      await fs.access(existingPath);
      return {
        videoUrl: patchNote.video_url,
        outputPath: existingPath,
        usedExisting: true,
        strategy: "remotion",
      };
    } catch {
      // fallthrough to render a new video
    }
  }

  if (strategy === "mock") {
    const buffer = mockBuffer ?? Buffer.from("mock-video");
    const mockDir = path.resolve(process.cwd(), ".typefully-mocks");
    await fs.mkdir(mockDir, { recursive: true });
    const outputPath = path.join(mockDir, `${patchNoteId}.mp4`);
    await fs.writeFile(outputPath, buffer);

    return {
      videoUrl: null,
      outputPath,
      usedExisting: false,
      strategy: "mock",
    };
  }

  let finalVideoData = (overrideVideoData ?? patchNote.video_data) as
    | {
        langCode?: string;
        topChanges?: Array<{ title: string; description: string }>;
        allChanges?: string[];
      }
    | undefined;

  const aiSummaries = patchNote.ai_summaries as
    | Array<{
        sha: string;
        message: string;
        aiSummary: string;
        additions: number;
        deletions: number;
      }>
    | null
    | undefined;

  if (aiSummaries && Array.isArray(aiSummaries) && aiSummaries.length > 0) {
    const topChanges = aiSummaries.slice(0, 3).map((summary) => {
      const commitTitle = summary.message.split("\n")[0];
      const truncated =
        commitTitle.length > 60
          ? `${commitTitle.substring(0, 60)}...`
          : commitTitle;

      return {
        title: truncated,
        description: summary.aiSummary,
      };
    });

    const allChanges = aiSummaries.map((summary) => {
      const commitTitle = summary.message.split("\n")[0];
      const truncated =
        commitTitle.length > 50
          ? `${commitTitle.substring(0, 50)}...`
          : commitTitle;

      return `${truncated}: ${summary.aiSummary}`;
    });

    finalVideoData = {
      langCode: "en",
      topChanges,
      allChanges,
    };
  }

  if (!finalVideoData) {
    finalVideoData = {
      langCode: "en",
      topChanges: [],
      allChanges: [],
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
      repositorySlug: resolvedRepoName,
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
      repositorySlug: resolvedRepoName,
      releaseTag: "Latest Update",
      openaiGeneration: finalVideoData,
      ...finalVideoData,
    },
  });

  const videoUrl = `/videos/${filename}`;

  const { error: updateError } = await supabase
    .from("patch_notes")
    .update({ video_url: videoUrl })
    .eq("id", patchNoteId);

  if (updateError) {
    throw new Error(`Failed to update patch note video URL: ${updateError.message}`);
  }

  return {
    videoUrl,
    outputPath,
    usedExisting: false,
    strategy: "remotion",
  };
}
