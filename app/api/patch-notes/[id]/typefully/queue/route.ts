import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  createTypefullyJob,
  getActiveTypefullyConfig,
  queueTypefullyThread,
  resolveVideoFilePath,
  updateTypefullyJob,
  uploadTypefullyVideo,
} from "@/lib/typefully";
import { renderPatchNoteVideo } from "@/lib/videos/render";

const isMockMode = process.env.TYPEFULLY_MOCK_MODE === "true";

const MAX_TWEET_LENGTH = 280;

function truncate(text: string, max = MAX_TWEET_LENGTH) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function buildHighlightsPost(patchNote: Database["public"]["Tables"]["patch_notes"]["Row"]) {
  const changes = patchNote.changes as
    | { added?: number; modified?: number; removed?: number }
    | null
    | undefined;

  if (!changes) {
    return null;
  }

  const parts: string[] = [];
  if (typeof changes.added === "number") {
    parts.push(`+${changes.added} additions`);
  }
  if (typeof changes.modified === "number") {
    parts.push(`${changes.modified} updates`);
  }
  if (typeof changes.removed === "number") {
    parts.push(`-${changes.removed} removals`);
  }

  if (!parts.length) return null;

  return truncate(`📊 Code changes: ${parts.join(" · ")}`);
}

function buildContributorPost(patchNote: Database["public"]["Tables"]["patch_notes"]["Row"]) {
  const contributors = (patchNote.contributors as string[] | null) ?? [];
  if (!contributors.length) return null;
  const names = contributors.slice(0, 4).join(", ");
  const more = contributors.length > 4 ? " + more" : "";
  return truncate(`🙌 Thanks to ${names}${more}!`);
}

function buildSummaryPosts(
  patchNote: Database["public"]["Tables"]["patch_notes"]["Row"]
) {
  const summaries = (patchNote.ai_summaries as
    | Array<{ message: string; aiSummary: string }>
    | null
    | undefined) ?? [];

  if (!summaries.length) {
    const topLines = (patchNote.content || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(" ");
    if (!topLines) return [];
    return [truncate(`📝 ${topLines}`)];
  }

  return summaries.slice(0, 3).map((summary, index) => {
    const title = summary.message.split("\n")[0];
    return truncate(`(${index + 1}/3) ${title}: ${summary.aiSummary}`);
  });
}

function buildThreadPosts(
  patchNote: Database["public"]["Tables"]["patch_notes"]["Row"],
  videoAssetUrl: string | null,
  baseUrl: string
) {
  const posts: Array<{ body: string; assetUrl?: string | null }> = [];
  const headline = truncate(
    `🚀 ${patchNote.title}\n${
      patchNote.ai_overall_summary || `Fresh updates from ${patchNote.repo_name}`
    }`
  );
  posts.push({ body: headline, assetUrl: videoAssetUrl });

  const highlights = buildHighlightsPost(patchNote);
  if (highlights) {
    posts.push({ body: highlights });
  }

  const summaryPosts = buildSummaryPosts(patchNote);
  posts.push(...summaryPosts.map((body) => ({ body })));

  const contributorPost = buildContributorPost(patchNote);
  if (contributorPost) {
    posts.push({ body: contributorPost });
  }

  const link = `${baseUrl}/blog/${patchNote.id}`;
  posts.push({ body: truncate(`🔗 Full notes: ${link}`) });

  return posts;
}

function resolveBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: patchNote, error } = await supabase
    .from("patch_notes")
    .select("*")
    .eq("id", id)
    .single();

  let note = patchNote as Database["public"]["Tables"]["patch_notes"]["Row"] | null;

  if ((!note || error) && isMockMode) {
    const nowIso = new Date().toISOString();
    note = {
      id,
      title: "Mock patch note",
      content: "### Updates\n- Added mock feature\n- Improved CI coverage",
      repo_name: "acme/repatch",
      repo_url: "https://github.com/acme/repatch",
      time_period: "1week",
      changes: { added: 42, modified: 7, removed: 3 },
      contributors: ["robot"],
      video_url: null,
      video_data: null,
      ai_summaries: [
        {
          sha: "mock1",
          message: "Add mock feature",
          aiSummary: "Shipped a mocked feature for tests.",
          additions: 21,
          deletions: 0,
        },
        {
          sha: "mock2",
          message: "Fix flaky tests",
          aiSummary: "Stabilised CI for the mock environment.",
          additions: 10,
          deletions: 2,
        },
      ],
      ai_overall_summary: "Automated mock summary for end-to-end tests.",
      generated_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    } as Database["public"]["Tables"]["patch_notes"]["Row"];
  }

  if (!note) {
    return NextResponse.json(
      { error: "Patch note not found" },
      { status: 404 }
    );
  }

  const config = await getActiveTypefullyConfig(supabase);
  if (!config) {
    return NextResponse.json(
      { error: "Typefully configuration is missing" },
      { status: 400 }
    );
  }

  let job = await createTypefullyJob(id, "rendering", config.id, supabase);

  try {
    const renderResult = await renderPatchNoteVideo({
      patchNoteId: id,
      videoData: note.video_data as any,
      repoName: note.repo_name,
    });

    let videoUrl = renderResult.videoUrl;
    if (!videoUrl && note.video_url) {
      videoUrl = note.video_url;
    }

    if (!videoUrl) {
      throw new Error("Video rendering did not produce a URL");
    }

    job = await updateTypefullyJob(
      job.id,
      {
        status: "uploading",
        metadata: {
          reusedVideo: renderResult.reusedExisting,
          skippedRender: renderResult.skipped ?? false,
        },
      },
      supabase
    );

    const videoPath = resolveVideoFilePath(videoUrl);
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(videoPath);
    } catch (readError) {
      if (isMockMode || renderResult.skipped) {
        buffer = Buffer.from("mock-video");
      } else {
        throw readError;
      }
    }
    const filename = path.basename(videoPath);

    const uploadResult = await uploadTypefullyVideo({
      config,
      filename,
      fileBuffer: buffer,
    });

    job = await updateTypefullyJob(
      job.id,
      {
        status: "queueing",
        video_asset_url: uploadResult.assetUrl,
        metadata: {
          ...(job.metadata as Record<string, unknown> | null),
          uploadUrl: uploadResult.uploadUrl ?? null,
        },
      },
      supabase
    );

    const posts = buildThreadPosts(note, uploadResult.assetUrl, resolveBaseUrl());

    const queueResult = await queueTypefullyThread({
      config,
      posts,
      metadata: {
        patchNoteId: id,
        postCount: posts.length,
        repo: note.repo_name,
      },
    });

    job = await updateTypefullyJob(
      job.id,
      {
        status: queueResult.status ?? "queued",
        thread_id: queueResult.threadId,
        metadata: {
          ...(job.metadata as Record<string, unknown> | null),
          patchNoteId: id,
          postCount: posts.length,
          repo: note.repo_name,
          scheduledAt: queueResult.scheduledAt ?? null,
          reusedVideo: renderResult.reusedExisting,
          skippedRender: renderResult.skipped ?? false,
        },
      },
      supabase
    );

    return NextResponse.json({
      jobId: job.id,
      status: queueResult.status ?? "queued",
      threadId: queueResult.threadId,
      scheduledAt: queueResult.scheduledAt ?? null,
      videoUrl,
      videoAssetUrl: uploadResult.assetUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await updateTypefullyJob(
      job.id,
      {
        status: "failed",
        error: message,
      },
      supabase
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
