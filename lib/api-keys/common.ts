import { Database } from '@/lib/supabase/database.types';

export const API_KEY_PREFIX = 'rk_';
export const API_KEY_VISIBLE_PREFIX_LENGTH = 8;

export type ApiKeyRow = Database['public']['Tables']['api_keys']['Row'];

export type ApiKeySummary = {
  id: string;
  name: string;
  description: string | null;
  tokenPreview: string;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

export async function hashApiKey(token: string): Promise<string> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto?.subtle) {
    const buffer = new TextEncoder().encode(token);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const { createHash } = await import('crypto');
  return createHash('sha256').update(token).digest('hex');
}

export function getApiKeyStatus(row: ApiKeyRow): 'active' | 'revoked' | 'expired' {
  if (row.revoked_at) {
    return 'revoked';
  }

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return 'expired';
  }

  return 'active';
}

export function toApiKeySummary(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tokenPreview: `${row.token_prefix}…${row.token_last_four}`,
    status: getApiKeyStatus(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
  };
}
