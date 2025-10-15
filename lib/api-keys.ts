import type { Database } from "./supabase/database.types";
import { createServiceClient } from "./supabase/service";

const KEY_PREFIX = "rk_";
const DEFAULT_RATE_LIMIT = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

type ApiKeyTable = Database["public"]["Tables"]["api_keys"];
export type ApiKeyRow = ApiKeyTable["Row"];

export type ApiKeySummary = {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  lastFour: string;
  rateLimitPerMinute: number;
  metadata: Record<string, unknown> | null;
  status: "active" | "revoked";
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  rotatedAt: string | null;
};

export type CreateApiKeyInput = {
  name: string;
  description?: string | null;
  rateLimitPerMinute?: number;
  createdBy?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RotateApiKeyInput = {
  id: string;
  requestedBy?: string | null;
};

export type RevokeApiKeyInput = {
  id: string;
  reason?: string | null;
};

const rateLimitWindows = new Map<string, { windowStart: number; count: number }>();

let useMemoryStore = process.env.NODE_ENV === "test";
const memoryStore = new Map<string, ApiKeyRow>();

function toSummary(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    lastFour: row.last_four,
    rateLimitPerMinute: row.rate_limit_per_minute,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    status: row.revoked_at ? "revoked" : "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    rotatedAt: row.rotated_at,
  };
}

function getRandomBytes(size: number) {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    const array = new Uint8Array(size);
    globalThis.crypto.getRandomValues(array);
    return array;
  }

  throw new Error("Secure random generation is unavailable");
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : typeof Buffer !== "undefined"
        ? Buffer.from(bytes).toString("base64")
        : (() => {
            throw new Error("Unable to encode random bytes");
          })();

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createRandomId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = getRandomBytes(16);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateApiKeySecret(): string {
  const bytes = getRandomBytes(32);
  return `${KEY_PREFIX}${bytesToBase64Url(bytes)}`;
}

export async function hashApiKey(token: string): Promise<string> {
  if (typeof globalThis.crypto !== "undefined" && "subtle" in globalThis.crypto) {
    const encoder = new TextEncoder();
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      encoder.encode(token)
    );
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const { createHash } = await import("crypto");
  return createHash("sha256").update(token).digest("hex");
}

function ensureRateLimitWindow(keyId: string, now: number) {
  const existing = rateLimitWindows.get(keyId);
  if (!existing || now - existing.windowStart >= RATE_LIMIT_WINDOW_MS) {
    const window = { windowStart: now, count: 0 };
    rateLimitWindows.set(keyId, window);
    return window;
  }
  return existing;
}

async function getSupabaseClient() {
  return createServiceClient();
}

async function insertSupabaseKey(input: ApiKeyTable["Insert"]): Promise<ApiKeyRow> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("api_keys")
    .insert(input)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create API key");
  }

  return data;
}

async function updateSupabaseKey(
  id: string,
  values: ApiKeyTable["Update"]
): Promise<ApiKeyRow> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("api_keys")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update API key");
  }

  return data;
}

async function fetchSupabaseKeyByHash(hash: string): Promise<ApiKeyRow | null> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("token_hash", hash)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function fetchSupabaseKeyById(id: string): Promise<ApiKeyRow | null> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function fetchSupabaseKeyList(): Promise<ApiKeyRow[]> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to load API keys");
  }

  return data;
}

async function touchSupabaseKeyUsage(id: string, timestamp: string) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ last_used_at: timestamp })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

function useMemory(): boolean {
  return useMemoryStore;
}

function makeMemoryRow(input: ApiKeyTable["Insert"]): ApiKeyRow {
  const now = new Date().toISOString();
  const row: ApiKeyRow = {
    id: input.id ?? createRandomId(),
    name: input.name!,
    description: input.description ?? null,
    created_by: input.created_by ?? null,
    token_hash: input.token_hash!,
    last_four: input.last_four!,
    rate_limit_per_minute: input.rate_limit_per_minute ?? DEFAULT_RATE_LIMIT,
    metadata: (input.metadata as Record<string, unknown> | null) ?? null,
    last_used_at: input.last_used_at ?? null,
    revoked_at: input.revoked_at ?? null,
    rotated_at: input.rotated_at ?? null,
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
  };
  memoryStore.set(row.id, row);
  return row;
}

function updateMemoryRow(id: string, values: ApiKeyTable["Update"]): ApiKeyRow {
  const existing = memoryStore.get(id);
  if (!existing) {
    throw new Error("API key not found");
  }
  const updated: ApiKeyRow = {
    ...existing,
    name: values.name ?? existing.name,
    description: values.description ?? existing.description,
    created_by: values.created_by ?? existing.created_by,
    token_hash: values.token_hash ?? existing.token_hash,
    last_four: values.last_four ?? existing.last_four,
    rate_limit_per_minute:
      values.rate_limit_per_minute ?? existing.rate_limit_per_minute,
    metadata:
      (values.metadata as Record<string, unknown> | null | undefined) ??
      existing.metadata,
    last_used_at: values.last_used_at ?? existing.last_used_at,
    revoked_at: values.revoked_at ?? existing.revoked_at,
    rotated_at: values.rotated_at ?? existing.rotated_at,
    created_at: values.created_at ?? existing.created_at,
    updated_at: values.updated_at ?? new Date().toISOString(),
  };
  memoryStore.set(id, updated);
  return updated;
}

async function findMemoryKeyByHash(hash: string): Promise<ApiKeyRow | null> {
  for (const row of memoryStore.values()) {
    if (row.token_hash === hash) {
      return row;
    }
  }
  return null;
}

export function __setUseMemoryApiKeyStore(enabled: boolean) {
  useMemoryStore = enabled;
}

export function __resetApiKeyMemoryStore() {
  memoryStore.clear();
  rateLimitWindows.clear();
}

export function __seedApiKeyMemoryStore(row: ApiKeyRow) {
  memoryStore.set(row.id, row);
}

export async function listApiKeys(): Promise<ApiKeySummary[]> {
  const rows = useMemory()
    ? Array.from(memoryStore.values()).sort((a, b) =>
        a.created_at < b.created_at ? 1 : -1
      )
    : await fetchSupabaseKeyList();

  return rows.map(toSummary);
}

export async function createApiKey(
  input: CreateApiKeyInput
): Promise<{ key: ApiKeySummary; secret: string }> {
  const secret = generateApiKeySecret();
  const hash = await hashApiKey(secret);
  const rateLimit = input.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT;

  if (useMemory()) {
    const row = makeMemoryRow({
      name: input.name,
      description: input.description ?? null,
      created_by: input.createdBy ?? null,
      token_hash: hash,
      last_four: secret.slice(-4),
      rate_limit_per_minute: rateLimit,
      metadata: input.metadata ?? null,
      last_used_at: null,
      revoked_at: null,
      rotated_at: null,
    });

    return { key: toSummary(row), secret };
  }

  const row = await insertSupabaseKey({
    name: input.name,
    description: input.description ?? null,
    created_by: input.createdBy ?? null,
    token_hash: hash,
    last_four: secret.slice(-4),
    rate_limit_per_minute: rateLimit,
    metadata: input.metadata ?? null,
    last_used_at: null,
    revoked_at: null,
    rotated_at: null,
  });

  return { key: toSummary(row), secret };
}

export async function rotateApiKey(
  input: RotateApiKeyInput
): Promise<{ key: ApiKeySummary; secret: string }> {
  const existing = useMemory()
    ? memoryStore.get(input.id) ?? null
    : await fetchSupabaseKeyById(input.id);

  if (!existing) {
    throw new Error("API key not found");
  }
  if (existing.revoked_at) {
    throw new Error("Cannot rotate a revoked API key");
  }

  const secret = generateApiKeySecret();
  const hash = await hashApiKey(secret);
  const now = new Date().toISOString();

  let updated: ApiKeyRow;

  if (useMemory()) {
    updated = updateMemoryRow(input.id, {
      token_hash: hash,
      last_four: secret.slice(-4),
      rotated_at: now,
      revoked_at: null,
      updated_at: now,
    });
  } else {
    updated = await updateSupabaseKey(input.id, {
      token_hash: hash,
      last_four: secret.slice(-4),
      rotated_at: now,
      revoked_at: null,
      updated_at: now,
    });
  }

  rateLimitWindows.delete(updated.id);

  return { key: toSummary(updated), secret };
}

export async function revokeApiKey(
  input: RevokeApiKeyInput
): Promise<ApiKeySummary> {
  const now = new Date().toISOString();

  let updated: ApiKeyRow;
  if (useMemory()) {
    updated = updateMemoryRow(input.id, {
      revoked_at: now,
      updated_at: now,
    });
  } else {
    updated = await updateSupabaseKey(input.id, {
      revoked_at: now,
      updated_at: now,
    });
  }

  rateLimitWindows.delete(updated.id);
  return toSummary(updated);
}

export async function getApiKeyByHash(hash: string): Promise<ApiKeyRow | null> {
  return useMemory() ? findMemoryKeyByHash(hash) : fetchSupabaseKeyByHash(hash);
}

export async function touchApiKeyUsage(id: string) {
  const now = new Date().toISOString();
  if (useMemory()) {
    updateMemoryRow(id, { last_used_at: now, updated_at: now });
    return;
  }
  await touchSupabaseKeyUsage(id, now);
}

export type EnforceResult =
  | {
      ok: true;
      key: ApiKeyRow;
      requestHeaders: Headers;
    }
  | {
      ok: false;
      status: number;
      body: { error: string };
      headers?: Headers;
    };

export async function enforceExternalApiAuth(headers: Headers): Promise<EnforceResult> {
  const token = headers.get("x-api-key") ?? headers.get("X-Api-Key");
  if (!token) {
    return {
      ok: false,
      status: 401,
      body: { error: "Missing X-Api-Key header" },
    };
  }

  let hash: string;
  try {
    hash = await hashApiKey(token);
  } catch (error) {
    return {
      ok: false,
      status: 500,
      body: { error: (error as Error).message },
    };
  }

  let key: ApiKeyRow | null;
  try {
    key = await getApiKeyByHash(hash);
  } catch (error) {
    return {
      ok: false,
      status: 500,
      body: { error: (error as Error).message },
    };
  }

  if (!key || key.revoked_at) {
    return {
      ok: false,
      status: 401,
      body: { error: "Invalid or revoked API key" },
    };
  }

  const now = Date.now();
  const limit = key.rate_limit_per_minute ?? DEFAULT_RATE_LIMIT;
  const window = ensureRateLimitWindow(key.id, now);

  if (window.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((window.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)
    );

    return {
      ok: false,
      status: 429,
      body: { error: "Rate limit exceeded" },
      headers: new Headers({ "Retry-After": retryAfterSeconds.toString() }),
    };
  }

  window.count += 1;
  rateLimitWindows.set(key.id, window);

  try {
    await touchApiKeyUsage(key.id);
  } catch (error) {
    return {
      ok: false,
      status: 500,
      body: { error: (error as Error).message },
    };
  }

  const forwardedHeaders = new Headers(headers);
  forwardedHeaders.set("x-repatch-api-key-id", key.id);
  forwardedHeaders.set("x-repatch-api-key-name", key.name);

  return {
    ok: true,
    key,
    requestHeaders: forwardedHeaders,
  };
}

export function __resetApiKeyRateLimits() {
  rateLimitWindows.clear();
}
