'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiKey,
  ApiKeyWithToken,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
} from '@/lib/api-keys';

export async function listApiKeysAction(): Promise<ApiKey[]> {
  return listApiKeys();
}

type CreateApiKeyInput = {
  name: string;
  description?: string | null;
  metadata?: string | null;
  expiresAt?: string | null;
};

export async function createApiKeyAction(
  input: CreateApiKeyInput
): Promise<ApiKeyWithToken> {
  const metadata = parseMetadata(input.metadata);
  const result = await createApiKey({
    name: input.name,
    description: input.description ?? null,
    metadata,
    expiresAt: input.expiresAt ?? null,
  });

  revalidatePath('/integrations/api-keys');
  return result;
}

type RotateApiKeyInput = {
  id: string;
  expiresAt?: string | null;
};

export async function rotateApiKeyAction(
  input: RotateApiKeyInput
): Promise<ApiKeyWithToken> {
  const result = await rotateApiKey(input.id, {
    expiresAt: input.expiresAt ?? null,
  });

  revalidatePath('/integrations/api-keys');
  return result;
}

export async function revokeApiKeyAction(id: string): Promise<ApiKey> {
  const result = await revokeApiKey(id);
  revalidatePath('/integrations/api-keys');
  return result;
}

function parseMetadata(raw: string | null | undefined) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Metadata must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Invalid metadata JSON'
    );
  }
}
