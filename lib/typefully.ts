import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import path from "path";

const TYPEFULLY_API_URL =
  process.env.TYPEFULLY_API_URL ?? "https://api.typefully.com/v1";

const isMockMode = process.env.TYPEFULLY_MOCK_MODE === "true";
const mockJobs = new Map<string, TypefullyJobRow>();

export type TypefullyConfigRow =
  Database["public"]["Tables"]["typefully_configs"]["Row"];
export type TypefullyJobRow =
  Database["public"]["Tables"]["typefully_jobs"]["Row"];

async function getClient(
  client?: SupabaseClient<Database>
): Promise<SupabaseClient<Database>> {
  if (client) return client;
  return createClient();
}

export async function getActiveTypefullyConfig(
  client?: SupabaseClient<Database>
): Promise<TypefullyConfigRow | null> {
  const supabase = await getClient(client);
  const { data, error } = await supabase
    .from("typefully_configs")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load Typefully config", error);
    if (process.env.TYPEFULLY_API_KEY) {
      const now = new Date().toISOString();
      const envConfig: TypefullyConfigRow = {
        id: "env-config",
        label: "Environment",
        api_key: process.env.TYPEFULLY_API_KEY,
        workspace_id: process.env.TYPEFULLY_WORKSPACE_ID ?? null,
        profile_id: process.env.TYPEFULLY_PROFILE_ID ?? null,
        team_id: null,
        created_at: now,
        updated_at: now,
      };
      return envConfig;
    }
    return null;
  }

  if (data) {
    return data;
  }

  if (process.env.TYPEFULLY_API_KEY) {
    const now = new Date().toISOString();
    const envConfig: TypefullyConfigRow = {
      id: "env-config",
      label: "Environment",
      api_key: process.env.TYPEFULLY_API_KEY,
      workspace_id: process.env.TYPEFULLY_WORKSPACE_ID ?? null,
      profile_id: process.env.TYPEFULLY_PROFILE_ID ?? null,
      team_id: null,
      created_at: now,
      updated_at: now,
    };
    return envConfig;
  }

  return null;
}

export interface SaveTypefullyConfigInput {
  apiKey: string;
  workspaceId?: string;
  profileId?: string;
  teamId?: string;
  label?: string;
}

export async function saveTypefullyConfig(
  input: SaveTypefullyConfigInput,
  client?: SupabaseClient<Database>
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await getClient(client);

  if (!input.apiKey.trim()) {
    return { ok: false, error: "API key is required" };
  }

  const existing = await getActiveTypefullyConfig(supabase);
  const payload:
    Database["public"]["Tables"]["typefully_configs"]["Insert"] = {
      api_key: input.apiKey.trim(),
      workspace_id: input.workspaceId?.trim() || null,
      profile_id: input.profileId?.trim() || null,
      team_id: input.teamId?.trim() || null,
      label: input.label?.trim() || null,
    };

  if (existing) {
    const { data, error } = await supabase
      .from("typefully_configs")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("typefully_configs")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data.id };
}

export interface UploadTypefullyVideoParams {
  config: TypefullyConfigRow;
  filename: string;
  fileBuffer: Buffer;
  contentType?: string;
}

export interface UploadTypefullyVideoResult {
  assetUrl: string;
  uploadUrl?: string;
}

async function requestWithAuth(
  config: TypefullyConfigRow,
  init: RequestInit & { endpoint: string }
) {
  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${config.api_key}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${TYPEFULLY_API_URL}${init.endpoint}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Typefully API error (${response.status} ${response.statusText}): ${text}`
    );
  }

  return response;
}

export async function uploadTypefullyVideo(
  params: UploadTypefullyVideoParams
): Promise<UploadTypefullyVideoResult> {
  const contentType = params.contentType ?? "video/mp4";

  if (isMockMode) {
    return {
      assetUrl: `https://mock.typefully.com/assets/${encodeURIComponent(
        params.filename
      )}`,
    };
  }

  const initResponse = await requestWithAuth(params.config, {
    endpoint: "/uploads",
    method: "POST",
    body: JSON.stringify({
      filename: params.filename,
      contentType,
      kind: "video",
      profileId: params.config.profile_id,
      workspaceId: params.config.workspace_id,
    }),
  });

  const initData = (await initResponse.json()) as {
    uploadUrl: string;
    assetUrl: string;
    fields?: Record<string, string>;
  };

  if (initData.fields) {
    // Multipart form upload
    const form = new FormData();
    Object.entries(initData.fields).forEach(([key, value]) => {
      form.append(key, value);
    });
    form.append("file", params.fileBuffer, params.filename);

    const uploadResponse = await fetch(initData.uploadUrl, {
      method: "POST",
      body: form,
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      throw new Error(
        `Failed to upload video to Typefully storage: ${uploadResponse.status} ${text}`
      );
    }
  } else {
    const uploadResponse = await fetch(initData.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: params.fileBuffer,
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      throw new Error(
        `Failed to upload video to Typefully storage: ${uploadResponse.status} ${text}`
      );
    }
  }

  return {
    assetUrl: initData.assetUrl,
    uploadUrl: initData.uploadUrl,
  };
}

export interface QueueTypefullyThreadParams {
  config: TypefullyConfigRow;
  posts: Array<{
    body: string;
    assetUrl?: string | null;
  }>;
  publishAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface QueueTypefullyThreadResult {
  threadId: string;
  status: string;
  scheduledAt?: string | null;
}

export async function queueTypefullyThread(
  params: QueueTypefullyThreadParams
): Promise<QueueTypefullyThreadResult> {
  if (isMockMode) {
    return {
      threadId: `mock-thread-${Date.now()}`,
      status: "queued",
      scheduledAt: params.publishAt ?? null,
    };
  }

  const response = await requestWithAuth(params.config, {
    endpoint: "/threads",
    method: "POST",
    body: JSON.stringify({
      profileId: params.config.profile_id,
      workspaceId: params.config.workspace_id,
      publishStatus: "queue",
      publishAt: params.publishAt ?? undefined,
      metadata: params.metadata,
      posts: params.posts.map((post) => ({
        body: post.body,
        assetUrl: post.assetUrl ?? undefined,
      })),
    }),
  });

  const data = (await response.json()) as {
    id?: string;
    status?: string;
    scheduledAt?: string | null;
    thread?: { id: string; status: string; scheduledAt?: string | null };
  };

  const resolved = data.thread ?? data;

  return {
    threadId: resolved.id ?? `typefully-${Date.now()}`,
    status: resolved.status ?? "queued",
    scheduledAt: resolved.scheduledAt ?? null,
  };
}

export async function createTypefullyJob(
  patchNoteId: string,
  status: string,
  configId?: string | null,
  client?: SupabaseClient<Database>
): Promise<TypefullyJobRow> {
  if (isMockMode) {
    const now = new Date().toISOString();
    const job: TypefullyJobRow = {
      id: `mock-job-${Date.now()}`,
      patch_note_id: patchNoteId,
      config_id: configId ?? null,
      status,
      thread_id: null,
      video_asset_url: null,
      error: null,
      metadata: null,
      created_at: now,
      updated_at: now,
    };
    mockJobs.set(job.id, job);
    return job;
  }
  const supabase = await getClient(client);
  const { data, error } = await supabase
    .from("typefully_jobs")
    .insert({
      patch_note_id: patchNoteId,
      status,
      config_id: configId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create Typefully job: ${error.message}`);
  }

  return data;
}

export async function updateTypefullyJob(
  jobId: string,
  updates: Partial<
    Database["public"]["Tables"]["typefully_jobs"]["Update"]
  >,
  client?: SupabaseClient<Database>
): Promise<TypefullyJobRow> {
  if (isMockMode) {
    const existing = mockJobs.get(jobId);
    if (!existing) {
      throw new Error("Mock Typefully job not found");
    }
    const now = new Date().toISOString();
    const updated: TypefullyJobRow = {
      ...existing,
      ...updates,
      metadata: (updates.metadata as TypefullyJobRow["metadata"]) ?? existing.metadata,
      video_asset_url:
        (updates.video_asset_url as TypefullyJobRow["video_asset_url"]) ?? existing.video_asset_url,
      thread_id:
        (updates.thread_id as TypefullyJobRow["thread_id"]) ?? existing.thread_id,
      status: (updates.status as string | undefined) ?? existing.status,
      error: (updates.error as string | null | undefined) ?? existing.error,
      updated_at: now,
    };
    mockJobs.set(jobId, updated);
    return updated;
  }
  const supabase = await getClient(client);
  const { data, error } = await supabase
    .from("typefully_jobs")
    .update(updates)
    .eq("id", jobId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update Typefully job: ${error.message}`);
  }

  return data;
}

export async function getLatestTypefullyJobForPatchNote(
  patchNoteId: string,
  client?: SupabaseClient<Database>
): Promise<TypefullyJobRow | null> {
  if (isMockMode) {
    const jobs = Array.from(mockJobs.values()).filter(
      (job) => job.patch_note_id === patchNoteId
    );
    if (!jobs.length) {
      return null;
    }
    return jobs.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  }
  const supabase = await getClient(client);
  const { data, error } = await supabase
    .from("typefully_jobs")
    .select("*")
    .eq("patch_note_id", patchNoteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load Typefully job", error);
    return null;
  }

  return data ?? null;
}

export function resolveVideoFilePath(videoUrl: string): string {
  if (videoUrl.startsWith("http")) {
    return videoUrl;
  }

  const sanitized = videoUrl.startsWith("/")
    ? videoUrl.slice(1)
    : videoUrl;
  return path.resolve(process.cwd(), "public", sanitized);
}
