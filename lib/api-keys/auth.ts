const DEFAULT_RATE_LIMIT = 60;

export type ApiKeyValidationError = {
  ok: false;
  status: number;
  message: string;
  retryAfter?: number;
};

export type ApiKeyValidationSuccess = {
  ok: true;
  record: ApiKeyRestRecord;
};

export type ApiKeyValidationResult =
  | ApiKeyValidationError
  | ApiKeyValidationSuccess;

export type ApiKeyRestRecord = {
  id: string;
  name: string;
  prefix: string;
  token_hash: string;
  rate_limit_per_minute: number | null;
  revoked_at: string | null;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __API_KEY_RATE_LIMIT?: Map<string, RateLimitState>;
}

function getRateLimitStore() {
  if (!globalThis.__API_KEY_RATE_LIMIT) {
    globalThis.__API_KEY_RATE_LIMIT = new Map();
  }
  return globalThis.__API_KEY_RATE_LIMIT;
}

export function resetRateLimitStore() {
  getRateLimitStore().clear();
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  return url;
}

function getServiceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return key;
}

function parseApiKey(value: string) {
  const match = value.match(/^rp_(?<prefix>[a-f0-9]{8})_(?<secret>[a-f0-9]{32})$/i);
  if (!match?.groups?.prefix || !match.groups.secret) {
    return null;
  }
  return match.groups.prefix.toLowerCase();
}

async function hashApiKey(value: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchApiKey(prefix: string): Promise<ApiKeyRestRecord | null> {
  const url = `${getSupabaseUrl()}/rest/v1/api_keys?select=id,name,prefix,token_hash,rate_limit_per_minute,revoked_at&prefix=eq.${prefix}`;
  const response = await fetch(url, {
    headers: {
      apikey: getServiceKey(),
      Authorization: `Bearer ${getServiceKey()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as ApiKeyRestRecord[];
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  return payload[0];
}

function enforceRateLimit(
  keyId: string,
  limit: number
): { ok: true } | { ok: false; retryAfter: number } {
  const store = getRateLimitStore();
  const now = Date.now();
  const minute = 60 * 1000;
  const entry = store.get(keyId);

  if (!entry || entry.resetAt <= now) {
    store.set(keyId, { count: 1, resetAt: now + minute });
    return { ok: true };
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  store.set(keyId, entry);
  return { ok: true };
}

export async function validateApiKey(
  headerValue: string | null
): Promise<ApiKeyValidationResult> {
  if (!headerValue) {
    return {
      ok: false,
      status: 401,
      message: "Missing X-Api-Key header",
    };
  }

  let prefix: string | null = null;
  try {
    prefix = parseApiKey(headerValue);
  } catch {
    return {
      ok: false,
      status: 400,
      message: "Invalid API key format",
    };
  }

  if (!prefix) {
    return {
      ok: false,
      status: 400,
      message: "Invalid API key format",
    };
  }

  let record: ApiKeyRestRecord | null = null;
  try {
    record = await fetchApiKey(prefix);
  } catch (error) {
    console.error("Failed to lookup API key", error);
    return {
      ok: false,
      status: 500,
      message: "Failed to validate API key",
    };
  }

  if (!record) {
    return {
      ok: false,
      status: 401,
      message: "API key not recognized",
    };
  }

  if (record.revoked_at) {
    return {
      ok: false,
      status: 403,
      message: "API key revoked",
    };
  }

  const hash = await hashApiKey(headerValue);
  if (hash !== record.token_hash) {
    return {
      ok: false,
      status: 401,
      message: "API key not recognized",
    };
  }

  const limit = record.rate_limit_per_minute || DEFAULT_RATE_LIMIT;
  const rate = enforceRateLimit(record.id, limit);

  if (!rate.ok) {
    return {
      ok: false,
      status: 429,
      message: "Rate limit exceeded",
      retryAfter: rate.retryAfter,
    };
  }

  return { ok: true, record };
}

export async function touchApiKeyUsage(id: string) {
  const url = `${getSupabaseUrl()}/rest/v1/api_keys?id=eq.${id}`;
  const body = JSON.stringify({ last_used_at: new Date().toISOString() });
  try {
    await fetch(url, {
      method: "PATCH",
      headers: {
        apikey: getServiceKey(),
        Authorization: `Bearer ${getServiceKey()}`,
        "Content-Type": "application/json",
      },
      body,
    });
  } catch (error) {
    console.warn("Unable to update API key usage", error);
  }
}
