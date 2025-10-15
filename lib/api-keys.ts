import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import type { Json } from '@/lib/supabase/database.types';

const TOKEN_BYTE_LENGTH = 32;
const TOKEN_PREFIX_LENGTH = 12;

export type ApiKey = {
  id: string;
  name: string;
  tokenPrefix: string;
  description: string | null;
  metadata: Record<string, unknown>;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiKeyWithToken = {
  token: string;
  key: ApiKey;
};

export interface ApiKeyRepository {
  create(data: {
    name: string;
    tokenPrefix: string;
    hashedToken: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
    expiresAt?: string | null;
  }): Promise<ApiKey>;
  list(): Promise<ApiKey[]>;
  rotate(id: string, data: {
    tokenPrefix: string;
    hashedToken: string;
    expiresAt?: string | null;
  }): Promise<ApiKey>;
  revoke(id: string): Promise<ApiKey>;
  findByHashedToken(hash: string): Promise<ApiKey | null>;
  touch(id: string): Promise<void>;
}

class SupabaseApiKeyRepository implements ApiKeyRepository {
  async create(data: {
    name: string;
    tokenPrefix: string;
    hashedToken: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
    expiresAt?: string | null;
  }): Promise<ApiKey> {
    const supabase = createServiceClient();
    const { data: row, error } = await supabase
      .from('api_keys')
      .insert({
        name: data.name,
        token_prefix: data.tokenPrefix,
        hashed_token: data.hashedToken,
        description: data.description ?? null,
        metadata: (data.metadata ?? {}) as Json,
        expires_at: data.expiresAt ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create API key: ${error.message}`);
    }

    return mapRowToApiKey(row);
  }

  async list(): Promise<ApiKey[]> {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('api_keys')
      .select(
        'id, name, token_prefix, description, metadata, last_used_at, expires_at, revoked_at, created_at, updated_at'
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list API keys: ${error.message}`);
    }

    return (data ?? []).map(mapRowToApiKey);
  }

  async rotate(
    id: string,
    data: { tokenPrefix: string; hashedToken: string; expiresAt?: string | null }
  ): Promise<ApiKey> {
    const supabase = createServiceClient();
    const { data: row, error } = await supabase
      .from('api_keys')
      .update({
        token_prefix: data.tokenPrefix,
        hashed_token: data.hashedToken,
        revoked_at: null,
        expires_at: data.expiresAt ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to rotate API key: ${error.message}`);
    }

    return mapRowToApiKey(row);
  }

  async revoke(id: string): Promise<ApiKey> {
    const supabase = createServiceClient();
    const { data: row, error } = await supabase
      .from('api_keys')
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to revoke API key: ${error.message}`);
    }

    return mapRowToApiKey(row);
  }

  async findByHashedToken(hash: string): Promise<ApiKey | null> {
    const supabase = createServiceClient();
    const { data: row, error } = await supabase
      .from('api_keys')
      .select(
        'id, name, token_prefix, description, metadata, last_used_at, expires_at, revoked_at, created_at, updated_at'
      )
      .eq('hashed_token', hash)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to lookup API key: ${error.message}`);
    }

    return row ? mapRowToApiKey(row) : null;
  }

  async touch(id: string): Promise<void> {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update API key usage: ${error.message}`);
    }
  }
}

const supabaseRepository = new SupabaseApiKeyRepository();

function mapRowToApiKey(row: any): ApiKey {
  const metadata =
    typeof row.metadata === 'object' && row.metadata !== null
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    description: row.description ?? null,
    metadata,
    lastUsedAt: row.last_used_at ?? null,
    expiresAt: row.expires_at ?? null,
    revokedAt: row.revoked_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function generateApiKeyToken(): { token: string; prefix: string; hash: string } {
  const raw = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
  const token = `rk_${raw}`;
  const prefix = token.replace(/[^a-zA-Z0-9]/g, '').slice(0, TOKEN_PREFIX_LENGTH);
  const hash = hashToken(token);

  return { token, prefix, hash };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createApiKey(
  params: {
    name: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
    expiresAt?: string | null;
  },
  repository: ApiKeyRepository = supabaseRepository
): Promise<ApiKeyWithToken> {
  const { token, prefix, hash } = generateApiKeyToken();
  const key = await repository.create({
    name: params.name,
    description: params.description ?? null,
    metadata: params.metadata ?? {},
    expiresAt: params.expiresAt ?? null,
    tokenPrefix: prefix,
    hashedToken: hash,
  });

  return { token, key };
}

export async function rotateApiKey(
  id: string,
  params: { expiresAt?: string | null },
  repository: ApiKeyRepository = supabaseRepository
): Promise<ApiKeyWithToken> {
  const { token, prefix, hash } = generateApiKeyToken();
  const key = await repository.rotate(id, {
    tokenPrefix: prefix,
    hashedToken: hash,
    expiresAt: params.expiresAt ?? null,
  });

  return { token, key };
}

export async function revokeApiKey(
  id: string,
  repository: ApiKeyRepository = supabaseRepository
): Promise<ApiKey> {
  return repository.revoke(id);
}

export async function listApiKeys(
  repository: ApiKeyRepository = supabaseRepository
): Promise<ApiKey[]> {
  return repository.list();
}

export type ApiKeyValidationResult =
  | { valid: true; key: ApiKey }
  | { valid: false; status: number; message: string };

export async function validateApiKey(
  token: string,
  repository: ApiKeyRepository = supabaseRepository
): Promise<ApiKeyValidationResult> {
  const hash = hashToken(token);
  const key = await repository.findByHashedToken(hash);

  if (!key) {
    return { valid: false, status: 401, message: 'Invalid API key' };
  }

  if (key.revokedAt) {
    return { valid: false, status: 403, message: 'API key has been revoked' };
  }

  if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) {
    return { valid: false, status: 403, message: 'API key has expired' };
  }

  await repository.touch(key.id);

  return { valid: true, key };
}

export function isApiKeyActive(key: ApiKey): boolean {
  if (key.revokedAt) return false;
  if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) return false;
  return true;
}

export { supabaseRepository as defaultRepository };
