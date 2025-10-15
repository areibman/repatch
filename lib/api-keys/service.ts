import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type ApiKeyRecord = Database["public"]["Tables"]["api_keys"]["Row"];

export type PublicApiKey = Omit<ApiKeyRecord, "token_hash">;

export type CreateApiKeyInput = {
  name: string;
  description?: string | null;
  rateLimitPerMinute?: number;
  createdBy?: string | null;
  rotateFromId?: string | null;
};

export type CreateApiKeyResult =
  | { ok: true; apiKey: PublicApiKey; token: string }
  | { ok: false; error: string };

export type MutateApiKeyResult = { ok: true } | { ok: false; error: string };

function toHex(buffer: Buffer) {
  return buffer.toString("hex");
}

function buildToken(prefix: string, secret: string) {
  return `rp_${prefix}_${secret}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function generateUniquePrefix(): Promise<string> {
  const supabase = await createClient();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = toHex(randomBytes(4));
    const { data, error } = await supabase
      .from("api_keys")
      .select("id")
      .eq("prefix", candidate)
      .maybeSingle();

    if (error) {
      continue;
    }

    if (!data) {
      return candidate;
    }
  }
  throw new Error("Failed to generate a unique API key prefix");
}

function sanitize(record: ApiKeyRecord): PublicApiKey {
  const { token_hash, ...rest } = record;
  return rest;
}

export async function listApiKeys(): Promise<PublicApiKey[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select(
      "id, name, description, prefix, rate_limit_per_minute, last_used_at, revoked_at, rotated_from, created_by, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => sanitize(row as ApiKeyRecord));
}

export async function createApiKey(
  input: CreateApiKeyInput
): Promise<CreateApiKeyResult> {
  if (!input.name.trim()) {
    return { ok: false, error: "Name is required" };
  }

  const supabase = await createClient();
  const prefix = await generateUniquePrefix();
  const secret = toHex(randomBytes(16));
  const token = buildToken(prefix, secret);
  const token_hash = hashToken(token);

  const payload: Database["public"]["Tables"]["api_keys"]["Insert"] = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    prefix,
    token_hash,
    rate_limit_per_minute: input.rateLimitPerMinute || 60,
    created_by: input.createdBy || null,
    rotated_from: input.rotateFromId || null,
  };

  const { data, error } = await supabase
    .from("api_keys")
    .insert(payload)
    .select(
      "id, name, description, prefix, rate_limit_per_minute, last_used_at, revoked_at, rotated_from, created_by, created_at, updated_at"
    )
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || "Failed to create API key" };
  }

  return { ok: true, apiKey: sanitize(data as ApiKeyRecord), token };
}

export async function revokeApiKey(id: string): Promise<MutateApiKeyResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function rotateApiKey(
  id: string,
  overrides?: Partial<Omit<CreateApiKeyInput, "rotateFromId">>
): Promise<CreateApiKeyResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("name, description, rate_limit_per_minute, created_by")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "API key not found" };
  }

  const base = data as Pick<
    ApiKeyRecord,
    "name" | "description" | "rate_limit_per_minute" | "created_by"
  >;

  const result = await createApiKey({
    name: overrides?.name || base.name,
    description:
      overrides?.description === undefined
        ? base.description
        : overrides.description,
    rateLimitPerMinute:
      overrides?.rateLimitPerMinute || base.rate_limit_per_minute,
    createdBy: overrides?.createdBy || base.created_by,
    rotateFromId: id,
  });

  if (!result.ok) {
    return result;
  }

  await revokeApiKey(id);
  return result;
}
