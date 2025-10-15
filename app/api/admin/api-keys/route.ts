import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  generateApiKeyToken,
  toApiKeySummary,
  type ApiKeySummary,
} from '@/lib/api-keys/server';
import type { Json } from '@/lib/supabase/database.types';

function normalizeMetadata(value: unknown): Record<string, Json> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, entryValue]) => [key, sanitizeJson(entryValue)] as const
  );

  return Object.fromEntries(entries) as Record<string, Json>;
}

function sanitizeJson(input: unknown): Json {
  if (
    input === null ||
    typeof input === 'string' ||
    typeof input === 'number' ||
    typeof input === 'boolean'
  ) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeJson(item));
  }

  if (typeof input === 'object') {
    const pairs = Object.entries(input as Record<string, unknown>).map(
      ([key, value]) => [key, sanitizeJson(value)] as const
    );

    return Object.fromEntries(pairs);
  }

  return null;
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api/admin/api-keys] Failed to list keys', error);
      return NextResponse.json({ error: 'Failed to load API keys' }, { status: 500 });
    }

    const keys: ApiKeySummary[] = (data ?? []).map(toApiKeySummary);
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('[api/admin/api-keys] Unexpected failure', error);
    return NextResponse.json({ error: 'Failed to load API keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const body = await request.json();

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required to create an API key' },
        { status: 400 }
      );
    }

    const description =
      typeof body.description === 'string' ? body.description.trim() || null : null;
    const expiresAt = normalizeDate(body.expiresAt);
    const metadata = normalizeMetadata(body.metadata);

    const { token, hashedToken, tokenPrefix, tokenLastFour } = generateApiKeyToken();

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        name,
        description,
        hashed_token: hashedToken,
        token_prefix: tokenPrefix,
        token_last_four: tokenLastFour,
        metadata,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error('[api/admin/api-keys] Failed to create key', error);
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
    }

    return NextResponse.json({ key: toApiKeySummary(data), token });
  } catch (error) {
    console.error('[api/admin/api-keys] Unexpected failure', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
