import fs from "fs/promises";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

const DEFAULT_CONFIG_SLUG = "default";
const DEFAULT_BASE_URL = "https://api.typefully.com";

export type TypefullyConfigRow =
  Database["public"]["Tables"]["typefully_configs"]["Row"];
export type TypefullyJobInsert =
  Database["public"]["Tables"]["typefully_jobs"]["Insert"];
export type PatchNoteRow = Database["public"]["Tables"]["patch_notes"]["Row"];

export type QueueThreadPayload = {
  draft: {
    profileId: string;
    posts: Array<{ text: string; mediaAssetIds?: string[] }>;
  };
  queue: {
    draftId: string;
  };
};

export type QueueThreadResult = {
  draftId: string;
  threadId: string | null;
  mediaAssetId: string | null;
  payload: QueueThreadPayload;
  response: {
    draft: unknown;
    queue: unknown;
    upload?: unknown;
  };
};

export type Supabase = SupabaseClient<Database>;

const TYPEFULLY_BASE_URL = (process.env.TYPEFULLY_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

export async function getTypefullyConfig(options?: {
  supabase?: Supabase;
}): Promise<TypefullyConfigRow | null> {
  const supabase = options?.supabase ?? (await createClient());
  const { data, error } = await supabase
    .from("typefully_configs")
    .select("*")
    .eq("slug", DEFAULT_CONFIG_SLUG)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Typefully config: ${error.message}`);
  }

  return (data as TypefullyConfigRow | null) ?? null;
}

export async function saveTypefullyConfig(
  input: Omit<TypefullyConfigRow, "id" | "created_at" | "updated_at">
): Promise<TypefullyConfigRow> {
  const supabase = await createClient();

  const payload: Database["public"]["Tables"]["typefully_configs"]["Insert"] = {
    slug: input.slug ?? DEFAULT_CONFIG_SLUG,
    profile_id: input.profile_id,
    api_key: input.api_key,
    display_name: input.display_name ?? null,
    team_id: input.team_id ?? null,
  };

  const { data, error } = await supabase
    .from("typefully_configs")
    .upsert(payload, { onConflict: "slug" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save Typefully config");
  }

  return data as TypefullyConfigRow;
}

function normalizeTweet(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 275) {
    return trimmed;
  }
  return `${trimmed.slice(0, 272)}...`;
}

function formatTimePeriod(period: PatchNoteRow["time_period"]): string {
  switch (period) {
    case "1day":
      return "Daily";
    case "1week":
      return "Weekly";
    case "1month":
      return "Monthly";
    default:
      return period;
  }
}

function extractHighlights(content: string): string[] {
  const lines = content.split("\n");
  const highlights: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-*+]/.test(line)) {
      highlights.push(line.replace(/^[-*+]\s*/, "").trim());
    }
    if (highlights.length >= 6) {
      break;
    }
  }

  if (highlights.length === 0) {
    const paragraphs = content
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (paragraphs.length > 0) {
      highlights.push(paragraphs[0]);
    }
  }

  return highlights;
}

export function buildThreadFromPatchNote(
  patchNote: PatchNoteRow,
  options?: { appUrl?: string }
): string[] {
  const period = formatTimePeriod(patchNote.time_period);
  const intro = normalizeTweet(
    `🚀 ${patchNote.title}\n\n${patchNote.repo_name} — ${period} update`
  );

  const highlights = extractHighlights(patchNote.content);
  const highlightTweets: string[] = [];

  for (let i = 0; i < highlights.length; i += 2) {
    const chunk = highlights.slice(i, i + 2);
    const prefix = i === 0 ? "Key updates" : "More changes";
    const body = chunk.map((item) => `• ${item}`).join("\n");
    highlightTweets.push(normalizeTweet(`${prefix}:\n${body}`));
  }

  const baseAppUrl = options?.appUrl?.replace(/\/$/, "") ?? "";
  const detailUrl = baseAppUrl
    ? `${baseAppUrl}/blog/${patchNote.id}`
    : patchNote.repo_url;
  const outro = normalizeTweet(
    `Read the full patch notes → ${detailUrl}`
  );

  const tweets = [intro, ...highlightTweets, outro].filter(Boolean);

  const deduped: string[] = [];
  for (const tweet of tweets) {
    if (tweet && !deduped.includes(tweet)) {
      deduped.push(tweet);
    }
  }

  return deduped;
}

type BodyInitLike =
  | Record<string, unknown>
  | string
  | Buffer
  | Uint8Array
  | ArrayBuffer
  | null;

async function typefullyFetch<T>(
  config: TypefullyConfigRow,
  pathOrUrl: string,
  init: RequestInit & { body?: BodyInitLike },
  options?: { expectJson?: boolean }
): Promise<T> {
  const expectJson = options?.expectJson ?? true;
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${TYPEFULLY_BASE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${config.api_key}`);

  const bodyValue = init.body;
  const isBinaryPayload =
    bodyValue instanceof Uint8Array ||
    bodyValue instanceof ArrayBuffer ||
    (typeof Buffer !== "undefined" && Buffer.isBuffer(bodyValue as Buffer));

  if (bodyValue && typeof bodyValue === "object" && !isBinaryPayload) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    body:
      bodyValue && typeof bodyValue === "object" && !isBinaryPayload
        ? JSON.stringify(bodyValue)
        : (bodyValue ?? undefined),
  });

  if (!response.ok) {
    const detail = expectJson ? await safeJson(response) : await response.text();
    throw new Error(
      `Typefully request failed (${response.status}): ${JSON.stringify(detail)}`
    );
  }

  if (!expectJson || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function uploadVideoAsset(
  config: TypefullyConfigRow,
  filePath: string
): Promise<{ assetId: string; uploadUrl: string }> {
  const filename = path.basename(filePath);
  const buffer = await fs.readFile(filePath);

  const initUpload = await typefullyFetch<{ assetId: string; uploadUrl: string }>(
    config,
    "/uploads",
    {
      method: "POST",
      body: {
        fileName: filename,
        contentType: "video/mp4",
        kind: "video",
      },
    }
  );

  await typefullyFetch(config, initUpload.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
    },
    body: buffer,
  }, { expectJson: false });

  return initUpload;
}

export async function queueThreadForPatchNote(args: {
  patchNote: PatchNoteRow;
  supabase?: Supabase;
  config?: TypefullyConfigRow;
  appUrl?: string;
  videoPath?: string | null;
}): Promise<QueueThreadResult> {
  const supabase = args.supabase ?? (await createClient());
  const config =
    args.config ?? (await getTypefullyConfig({ supabase })) ?? undefined;

  if (!config) {
    throw new Error("Typefully integration is not configured");
  }

  const posts = buildThreadFromPatchNote(args.patchNote, {
    appUrl: args.appUrl,
  });

  let mediaAssetId: string | null = null;
  let uploadResponse: unknown;

  if (args.videoPath) {
    const asset = await uploadVideoAsset(config, args.videoPath);
    mediaAssetId = asset.assetId;
    uploadResponse = asset;
  }

  const draftPayload = {
    profileId: config.profile_id,
    posts: posts.map((text, index) => ({
      text,
      mediaAssetIds:
        index === 0 && mediaAssetId ? [mediaAssetId] : undefined,
    })),
  } satisfies QueueThreadPayload["draft"];

  const draftResponse = await typefullyFetch<{ id: string }>(config, "/drafts", {
    method: "POST",
    body: draftPayload,
  });

  const queuePayload = {
    draftId: draftResponse.id,
  } satisfies QueueThreadPayload["queue"];

  const queueResponse = await typefullyFetch<{ id?: string; threadId?: string }>(
    config,
    "/queue",
    {
      method: "POST",
      body: queuePayload,
    }
  );

  const result: QueueThreadResult = {
    draftId: draftResponse.id,
    threadId: queueResponse.threadId ?? queueResponse.id ?? null,
    mediaAssetId,
    payload: {
      draft: draftPayload,
      queue: queuePayload,
    },
    response: {
      draft: draftResponse,
      queue: queueResponse,
      upload: uploadResponse,
    },
  };

  return result;
}
