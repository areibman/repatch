import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { VideoData } from "@/types/patch-note";

export const TYPEFULLY_DEFAULT_BASE_URL = "https://api.typefully.com/v1";

export type TypefullyConfigRow =
  Database["public"]["Tables"]["typefully_configs"]["Row"];
export type TypefullyJobRow =
  Database["public"]["Tables"]["typefully_jobs"]["Row"];
export type PatchNoteRow =
  Database["public"]["Tables"]["patch_notes"]["Row"];

export type TypefullyThreadPost = {
  text: string;
  mediaId?: string | null;
};

export type TypefullyUploadResult = {
  mediaId: string;
  uploadUrl?: string;
  raw: Json;
};

export type TypefullyQueueOptions = {
  posts: TypefullyThreadPost[];
  publishAt?: string | null;
  mediaId?: string | null;
  patchNoteUrl?: string;
};

export type TypefullyQueueResponse = {
  id?: string;
  thread?: { id?: string; [key: string]: Json } | null;
  state?: string;
  [key: string]: Json;
};

const MAX_POST_LENGTH = 280;

function truncatePost(text: string): string {
  if (text.length <= MAX_POST_LENGTH) return text;
  return `${text.slice(0, MAX_POST_LENGTH - 1).trim()}…`;
}

function sanitizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function extractHighlights(content: string, limit: number): string[] {
  const lines = content.split(/\r?\n/);
  const highlights: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      highlights.push(trimmed.replace(/^[-*]\s*/, ""));
    }
    if (highlights.length >= limit) break;
  }
  if (highlights.length === 0) {
    const paragraphs = content.split(/\n{2,}/).map((p) => p.trim());
    for (const paragraph of paragraphs) {
      if (paragraph) {
        highlights.push(paragraph);
      }
      if (highlights.length >= limit) break;
    }
  }
  return highlights.slice(0, limit);
}

export function buildThreadPostsFromPatchNote(
  patchNote: PatchNoteRow,
  options: { patchNoteUrl: string; videoUrl?: string | null; maxBodyPosts?: number }
): TypefullyThreadPost[] {
  const posts: TypefullyThreadPost[] = [];
  const maxBodyPosts = options.maxBodyPosts ?? 3;

  const intro = sanitizeWhitespace(
    truncatePost(`🚀 ${patchNote.repo_name}: ${patchNote.title}`)
  );
  posts.push({ text: intro });

  const highlights = extractHighlights(patchNote.content, maxBodyPosts);
  highlights.forEach((highlight) => {
    const bullet = truncatePost(`• ${highlight}`);
    posts.push({ text: bullet });
  });

  const links: string[] = [];
  if (options.videoUrl) {
    links.push(`🎬 Watch: ${options.videoUrl}`);
  }
  links.push(`🔗 Notes: ${options.patchNoteUrl}`);

  const outro = truncatePost([
    "Thanks for following along!",
    ...links,
    "#buildinpublic #shipit",
  ].join("\n"));

  posts.push({ text: outro });
  return posts;
}

function resolveBaseUrl(): string {
  return process.env.TYPEFULLY_API_BASE_URL || TYPEFULLY_DEFAULT_BASE_URL;
}

export async function getActiveTypefullyConfig(
  supabase: SupabaseClient<Database>
): Promise<TypefullyConfigRow | null> {
  const { data, error } = await supabase
    .from("typefully_configs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Typefully configuration: ${error.message}`);
  }

  return data ?? null;
}

export async function uploadTypefullyVideo(
  config: TypefullyConfigRow,
  videoBuffer: Buffer,
  options: { filename: string; contentType?: string }
): Promise<TypefullyUploadResult> {
  if (process.env.TYPEFULLY_API_MOCK === "true") {
    return {
      mediaId: `mock-media-${Date.now()}`,
      raw: { mocked: true, filename: options.filename },
    };
  }

  const baseUrl = resolveBaseUrl();
  const initResponse = await fetch(`${baseUrl}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify({
      filename: options.filename,
      mimeType: options.contentType ?? "video/mp4",
      profileId: config.profile_id,
      teamId: config.workspace_id ?? undefined,
    }),
  });

  if (!initResponse.ok) {
    const message = await initResponse.text();
    throw new Error(`Typefully media init failed: ${message}`);
  }

  const initJson = (await initResponse.json()) as Json & {
    upload_url?: string;
    uploadUrl?: string;
    media_id?: string;
    id?: string;
  };

  const uploadUrl = (initJson.upload_url || initJson.uploadUrl) as string | undefined;
  const mediaId = (initJson.media_id || initJson.id) as string | undefined;

  if (uploadUrl) {
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": options.contentType ?? "video/mp4",
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      const message = await uploadResponse.text();
      throw new Error(`Typefully media upload failed: ${message}`);
    }
  }

  if (!mediaId) {
    throw new Error("Typefully did not return a media identifier");
  }

  return {
    mediaId,
    uploadUrl,
    raw: initJson,
  };
}

export async function queueTypefullyThread(
  config: TypefullyConfigRow,
  options: TypefullyQueueOptions
): Promise<TypefullyQueueResponse> {
  if (options.posts.length === 0) {
    throw new Error("Thread must contain at least one post");
  }

  if (process.env.TYPEFULLY_API_MOCK === "true") {
    return {
      id: `mock-thread-${Date.now()}`,
      state: "queued",
      thread: {
        id: `mock-thread-${Date.now()}`,
        posts: options.posts.map((post) => ({
          body: post.text,
          mediaId: post.mediaId ?? null,
        })),
      },
    };
  }

  const baseUrl = resolveBaseUrl();
  const payload = {
    profileId: config.profile_id,
    teamId: config.workspace_id ?? undefined,
    posts: options.posts.map((post) => ({
      body: post.text,
      media: post.mediaId ? [{ id: post.mediaId, type: "video" }] : [],
    })),
    publishAction: "queue",
    publishAt: options.publishAt ?? null,
    metadata: {
      patchNoteUrl: options.patchNoteUrl ?? null,
    },
  };

  const response = await fetch(`${baseUrl}/drafts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Typefully thread creation failed: ${message}`);
  }

  return (await response.json()) as TypefullyQueueResponse;
}

export function deriveVideoDataFromSummaries(
  aiSummaries: Json | null
): VideoData | null {
  if (!aiSummaries) return null;
  if (!Array.isArray(aiSummaries)) return null;
  if (aiSummaries.length === 0) return null;

  const summaries = aiSummaries as Array<
    {
      sha?: string;
      message?: string;
      aiSummary?: string;
    } & Record<string, unknown>
  >;

  const topChanges = summaries.slice(0, 3).map((summary) => {
    const commitTitle = (summary.message || "").split("\n")[0];
    const title = commitTitle.length > 60
      ? `${commitTitle.slice(0, 60)}…`
      : commitTitle;
    return {
      title: title || "Update",
      description: summary.aiSummary || "No summary provided",
    };
  });

  const allChanges = summaries.map((summary) => {
    const commitTitle = (summary.message || "").split("\n")[0];
    const shortTitle = commitTitle.length > 50
      ? `${commitTitle.slice(0, 50)}…`
      : commitTitle;
    const description = summary.aiSummary || "Changes shipped";
    return `${shortTitle}: ${description}`;
  });

  return {
    langCode: "en",
    topChanges,
    allChanges,
  };
}

export function parseVideoData(videoData: Json | null): VideoData | null {
  if (!videoData) return null;
  try {
    const parsed = videoData as VideoData;
    if (
      typeof parsed.langCode === "string" &&
      Array.isArray(parsed.topChanges) &&
      Array.isArray(parsed.allChanges)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
