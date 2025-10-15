import { createClient } from "@/lib/supabase/server";
import { Database, Json } from "@/lib/supabase/database.types";

const DEFAULT_BASE_URL =
  process.env.TYPEFULLY_API_BASE_URL?.replace(/\/$/, "") ||
  "https://api.typefully.com/v1";

export class TypefullyError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TypefullyError";
    this.status = status;
    this.details = details;
  }
}

export type TypefullyConfigRow = Database["public"]["Tables"]["typefully_configs"]["Row"];

export type SaveTypefullyConfigInput = {
  profileId: string;
  apiKey: string;
  workspaceId?: string | null;
};

export type SaveTypefullyConfigResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function listTypefullyConfigs(): Promise<
  Array<Omit<TypefullyConfigRow, "api_key">>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("typefully_configs")
    .select("id, profile_id, workspace_id, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as Array<Omit<TypefullyConfigRow, "api_key">>;
}

export async function getTypefullyConfig(
  profileId?: string
): Promise<TypefullyConfigRow | null> {
  const supabase = await createClient();
  let query = supabase
    .from("typefully_configs")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1);

  if (profileId) {
    query = query.eq("profile_id", profileId).limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as TypefullyConfigRow;
}

export async function saveTypefullyConfig(
  input: SaveTypefullyConfigInput
): Promise<SaveTypefullyConfigResult> {
  const profileId = input.profileId.trim();
  const apiKey = input.apiKey.trim();
  const workspaceId = input.workspaceId?.trim() || null;

  if (!profileId) {
    return { ok: false, error: "Profile ID is required" };
  }
  if (!apiKey) {
    return { ok: false, error: "API key is required" };
  }

  const payload: Database["public"]["Tables"]["typefully_configs"]["Insert"] = {
    profile_id: profileId,
    api_key: apiKey,
    workspace_id: workspaceId,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("typefully_configs")
    .upsert(payload, { onConflict: "profile_id" })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || "Failed to save config" };
  }

  return { ok: true, id: (data as { id: string }).id };
}

type TypefullyRequestOptions = RequestInit & { skipJson?: boolean };

type TypefullyThreadPost = {
  body: string;
  mediaIds?: string[];
};

type CreateThreadInput = {
  profileId: string;
  posts: TypefullyThreadPost[];
  status?: "queued" | "draft";
  scheduledAt?: string | null;
  title?: string;
};

type TypefullyThreadResponse = {
  id: string;
  status: string;
  url?: string;
  share_url?: string;
  scheduled_at?: string | null;
};

type UploadVideoResponse = {
  id: string;
  url?: string;
};

export class TypefullyClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  readonly workspaceId?: string | null;

  constructor(config: { apiKey: string; workspaceId?: string | null; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.workspaceId = config.workspaceId;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  private async request<T>(
    path: string,
    options: TypefullyRequestOptions = {}
  ): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json");

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let details: unknown;
      try {
        details = await response.clone().json();
      } catch {
        details = await response.text();
      }
      throw new TypefullyError(
        `Typefully API responded with status ${response.status}`,
        response.status,
        details
      );
    }

    if (options.skipJson || response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async uploadVideoFromUrl(input: {
    profileId: string;
    videoUrl: string;
    altText?: string;
  }): Promise<UploadVideoResponse> {
    const body = {
      profileId: input.profileId,
      type: "video",
      sourceUrl: input.videoUrl,
      altText: input.altText,
      workspaceId: this.workspaceId ?? undefined,
    };

    return this.request<UploadVideoResponse>("/media", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async createThread(input: CreateThreadInput): Promise<TypefullyThreadResponse> {
    const body = {
      profileId: input.profileId,
      status: input.status ?? "queued",
      posts: input.posts.map((post) => ({
        body: post.body,
        mediaIds: post.mediaIds?.length ? post.mediaIds : undefined,
      })),
      workspaceId: this.workspaceId ?? undefined,
      scheduledAt: input.scheduledAt ?? undefined,
      title: input.title,
    };

    return this.request<TypefullyThreadResponse>("/threads", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

export async function getTypefullyClient(profileId?: string) {
  const config = await getTypefullyConfig(profileId);
  if (!config) {
    throw new TypefullyError("Typefully is not configured", 400);
  }
  const client = new TypefullyClient({
    apiKey: config.api_key,
    workspaceId: config.workspace_id,
  });
  return { client, config };
}

export type TypefullyJobStatus = "queued" | "failed" | "draft";

export type CreateTypefullyJobInput = {
  patchNoteId: string;
  status: TypefullyJobStatus;
  threadId?: string | null;
  queueUrl?: string | null;
  videoUrl?: string | null;
  videoUploadId?: string | null;
  payload?: Json | null;
  response?: Json | null;
  error?: string | null;
};

export async function createTypefullyJob(
  input: CreateTypefullyJobInput
): Promise<string | null> {
  const supabase = await createClient();
  const payload: Database["public"]["Tables"]["typefully_jobs"]["Insert"] = {
    patch_note_id: input.patchNoteId,
    status: input.status,
    thread_id: input.threadId ?? null,
    queue_url: input.queueUrl ?? null,
    video_url: input.videoUrl ?? null,
    video_upload_id: input.videoUploadId ?? null,
    payload: input.payload ?? null,
    response: input.response ?? null,
    error: input.error ?? null,
  };

  const { data, error } = await supabase
    .from("typefully_jobs")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return null;
  }

  return (data as { id: string }).id;
}

export type TypefullyJobSummary = {
  id: string;
  status: string;
  thread_id: string | null;
  queue_url: string | null;
  video_url: string | null;
  video_upload_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export async function getLatestTypefullyJob(
  patchNoteId: string
): Promise<TypefullyJobSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("typefully_jobs")
    .select(
      "id, status, thread_id, queue_url, video_url, video_upload_id, error, created_at, updated_at"
    )
    .eq("patch_note_id", patchNoteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as TypefullyJobSummary;
}
