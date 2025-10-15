import { NextRequest } from 'next/server';
import { handleExternalApiAuth } from '@/lib/api-keys/middleware';
import { resetRateLimits } from '@/lib/rate-limit';

type SupabaseApiKeyRow = {
  id: string;
  name: string;
  description: string | null;
  token_prefix: string;
  token_last_four: string;
  hashed_token: string;
  metadata: Record<string, unknown>;
  last_used_at: string | null;
  rotated_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

describe('handleExternalApiAuth', () => {
  const activeRecord: SupabaseApiKeyRow = {
    id: '123',
    name: 'Test key',
    description: null,
    token_prefix: 'rk_abcdef12',
    token_last_four: 'wxyz',
    hashed_token: 'hash',
    metadata: {},
    last_used_at: null,
    rotated_at: null,
    revoked_at: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
    process.env.EXTERNAL_API_RATE_LIMIT = '2';
    process.env.EXTERNAL_API_RATE_WINDOW_MS = '60000';
    resetRateLimits();
  });

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.EXTERNAL_API_RATE_LIMIT;
    delete process.env.EXTERNAL_API_RATE_WINDOW_MS;
  });

  function buildRequest(headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost/api/external/patch-notes', {
      headers,
    });
  }

  it('rejects requests without an API key header', async () => {
    const response = await handleExternalApiAuth(buildRequest());
    expect(response.status).toBe(401);
  });

  it('returns unauthorized for unknown API keys', async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    const response = await handleExternalApiAuth(
      buildRequest({ 'x-api-key': 'rk_missing' }),
      fetcher
    );

    expect(fetcher).toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it('rejects revoked API keys', async () => {
    const revokedRecord: SupabaseApiKeyRow = {
      ...activeRecord,
      revoked_at: new Date().toISOString(),
    };
    const fetcher = jest.fn(async () =>
      new Response(JSON.stringify([revokedRecord]), { status: 200 })
    );

    const response = await handleExternalApiAuth(
      buildRequest({ 'x-api-key': 'rk_revoked' }),
      fetcher
    );

    expect(response.status).toBe(401);
  });

  it('allows valid API keys and forwards rate limit headers', async () => {
    const fetcher = jest.fn(async () =>
      new Response(JSON.stringify([activeRecord]), { status: 200 })
    );

    const response = await handleExternalApiAuth(
      buildRequest({ 'x-api-key': 'rk_valid' }),
      fetcher
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Rate-Limit-Limit')).toBe('2');
    expect(response.headers.get('X-Rate-Limit-Remaining')).toBe('1');
  });

  it('enforces rate limits once the threshold is exceeded', async () => {
    process.env.EXTERNAL_API_RATE_LIMIT = '1';
    resetRateLimits();

    const fetcher = jest.fn(async () =>
      new Response(JSON.stringify([activeRecord]), { status: 200 })
    );

    const first = await handleExternalApiAuth(
      buildRequest({ 'x-api-key': 'rk_valid' }),
      fetcher
    );
    expect(first.status).toBe(200);

    const second = await handleExternalApiAuth(
      buildRequest({ 'x-api-key': 'rk_valid' }),
      fetcher
    );
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBeTruthy();
  });
});
