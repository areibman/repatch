import path from "path";
import fs from "fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "@/remotion-webpack-override";
import { createClient } from "@/lib/supabase/server";

export type RenderPatchNoteVideoOptions = {
  patchNoteId: string;
  repoName?: string | null;
  videoData?: any;
  force?: boolean;
};

export type RenderPatchNoteVideoResult = {
  videoUrl: string;
  outputPath: string;
  videoData: any;
  patchNote: {
    id: string;
    repo_name: string;
    repo_url: string;
    title: string;
    content: string;
    changes: any;
    contributors: string[];
    video_data: any;
    ai_summaries: any;
  };
};

export async function renderPatchNoteVideoFromDatabase(
  options: RenderPatchNoteVideoOptions
): Promise<RenderPatchNoteVideoResult> {
  const supabase = await createClient();
  const { data: patchNote, error } = await supabase
    .from("patch_notes")
    .select(
      "id, repo_name, repo_url, title, content, changes, contributors, video_data, video_url, ai_summaries"
    )
    .eq("id", options.patchNoteId)
    .single();

  if (error || !patchNote) {
    throw new Error("Failed to load patch note for video rendering");
  }

  if (patchNote.video_url && !options.force) {
    return {
      videoUrl: patchNote.video_url,
      outputPath: path.join(
        process.cwd(),
        "public",
        patchNote.video_url.replace(/^\//, "")
      ),
      videoData: patchNote.video_data,
      patchNote,
    };
  }

  let finalVideoData = patchNote.video_data ?? options.videoData;

  if (
    patchNote.ai_summaries &&
    Array.isArray(patchNote.ai_summaries) &&
    patchNote.ai_summaries.length > 0
  ) {
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
            ? `${commitTitle.substring(0, 60)}...`
            : commitTitle,
        description: summary.aiSummary,
      };
    });

    const allChanges = aiSummaries.map((summary) => {
      const commitTitle = summary.message.split("\n")[0];
      const shortTitle =
        commitTitle.length > 50
          ? `${commitTitle.substring(0, 50)}...`
          : commitTitle;
      return `${shortTitle}: ${summary.aiSummary}`;
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

  if (process.env.REMOTION_MOCK_RENDER === "1") {
    const outputDir = path.resolve(process.cwd(), "public", "videos");
    await fs.mkdir(outputDir, { recursive: true });
    const filename = `patch-note-${options.patchNoteId}-mock.mp4`;
    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, Buffer.from("mock"));
    const videoUrl = `/videos/${filename}`;

    await supabase
      .from("patch_notes")
      .update({ video_url: videoUrl })
      .eq("id", options.patchNoteId);

    return {
      videoUrl,
      outputPath,
      videoData: finalVideoData,
      patchNote,
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
      openaiGeneration: finalVideoData,
      ...finalVideoData,
    },
  });

  const outputDir = path.resolve(process.cwd(), "public", "videos");
  await fs.mkdir(outputDir, { recursive: true });

  const filename = `patch-note-${options.patchNoteId}-${Date.now()}.mp4`;
  const outputPath = path.join(outputDir, filename);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: {
      repositorySlug: patchNote.repo_name || options.repoName || "repository",
      releaseTag: "Latest Update",
      openaiGeneration: finalVideoData,
      ...finalVideoData,
    },
  });

  const videoUrl = `/videos/${filename}`;

  await supabase
    .from("patch_notes")
    .update({ video_url: videoUrl })
    .eq("id", options.patchNoteId);

  return {
    videoUrl,
    outputPath,
    videoData: finalVideoData,
    patchNote,
  };
}
