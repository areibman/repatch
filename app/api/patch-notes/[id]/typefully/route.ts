import { NextRequest, NextResponse } from "next/server";
import {
  createTypefullyJob,
  getLatestTypefullyJob,
  getTypefullyClient,
  TypefullyError,
} from "@/lib/typefully";
import { renderPatchNoteVideoFromDatabase } from "@/lib/remotion/render";
import type { Json } from "@/lib/supabase/database.types";

type RenderedPatchNote = Awaited<
  ReturnType<typeof renderPatchNoteVideoFromDatabase>
>["patchNote"];

function truncate(text: string, limit = 275) {
  if (!text) return "";
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function formatBullet(line: string) {
  const cleaned = line.replace(/^([-*]|\d+\.)\s*/, "").trim();
  const bullet = `• ${cleaned}`;
  return truncate(bullet, 240);
}

function chunkBullets(bullets: string[]): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < bullets.length; i += 3) {
    const chunk = bullets.slice(i, i + 3).join("\n");
    chunks.push(truncate(chunk, 270));
  }
  return chunks;
}

function extractBullets(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^([-*]|\d+\.)\s+/.test(line))
    .slice(0, 9)
    .map(formatBullet);
}

function buildAbsoluteUrl(base: string, target: string) {
  if (/^https?:\/\//i.test(target)) {
    return target;
  }
  return new URL(target, base).toString();
}

function buildThreadPosts(patchNote: RenderedPatchNote, baseUrl: string) {
  const posts: Array<{ body: string; mediaIds?: string[] }> = [];
  const intro = truncate(
    `🚀 ${patchNote.title}\n\n${patchNote.repo_name} updates are live!`,
    270
  );
  posts.push({ body: intro });

  const bullets = extractBullets(patchNote.content || "");
  const bulletPosts = chunkBullets(bullets);
  posts.push(...bulletPosts.map((body) => ({ body })));

  if (patchNote.changes) {
    const { added = 0, modified = 0, removed = 0 } = patchNote.changes as Record<
      string,
      number
    >;
    const summary = truncate(
      `📊 Changes: +${added} additions · ${modified} updates · -${removed} deletions`,
      270
    );
    posts.push({ body: summary });
  }

  const detailUrl = buildAbsoluteUrl(baseUrl, `/blog/${patchNote.id}`);
  const outro = truncate(`Read the full notes:\n${detailUrl}`, 275);
  posts.push({ body: outro });

  return posts;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await getLatestTypefullyJob(id);
  return NextResponse.json(job);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  let payload: Array<{ body: string; mediaIds?: string[] }> | null = null;
  let videoUrl: string | null = null;
  let uploadId: string | null = null;

  try {
    const body = await request.json().catch(() => ({}));
    const { client, config } = await getTypefullyClient(body.profileId);

    const renderResult = await renderPatchNoteVideoFromDatabase({
      patchNoteId: id,
      repoName: body.repoName,
      videoData: body.videoData,
      force: Boolean(body.forceRender),
    });

    const patchNote = renderResult.patchNote;
    videoUrl = renderResult.videoUrl;

    const posts = buildThreadPosts(patchNote, baseUrl);
    payload = posts;

    if (videoUrl) {
      const absoluteVideoUrl = buildAbsoluteUrl(baseUrl, videoUrl);
      const upload = await client.uploadVideoFromUrl({
        profileId: config.profile_id,
        videoUrl: absoluteVideoUrl,
        altText: truncate(
          `Patch note video for ${patchNote.repo_name}: ${patchNote.title}`,
          420
        ),
      });
      uploadId = upload.id;
      if (uploadId) {
        posts[0] = { ...posts[0], mediaIds: [uploadId] };
      }
    }

    const thread = await client.createThread({
      profileId: config.profile_id,
      posts,
      status: "queued",
      title: truncate(patchNote.title, 90),
    });

    await createTypefullyJob({
      patchNoteId: id,
      status: "queued",
      threadId: thread.id,
      queueUrl: thread.url ?? thread.share_url ?? null,
      videoUrl: videoUrl,
      videoUploadId: uploadId,
      payload: payload as unknown as Json,
      response: thread as unknown as Json,
    });

    return NextResponse.json({
      success: true,
      threadId: thread.id,
      queueUrl: thread.url ?? thread.share_url ?? null,
      videoUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to queue Typefully thread";
    await createTypefullyJob({
      patchNoteId: id,
      status: "failed",
      videoUrl,
      videoUploadId: uploadId,
      payload: (payload as unknown as Json) ?? null,
      error: message,
    });
    const status = error instanceof TypefullyError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
