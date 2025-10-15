import { NextResponse, type NextRequest } from 'next/server';
import { hashApiKey, type ApiKeyRow, getApiKeyStatus } from './common';
import { checkRateLimit } from '@/lib/rate-limit';

type Fetcher = typeof fetch;

type FetchApiKeyOptions = {
  hashedToken: string;
  fetcher?: Fetcher;
};

export async function fetchApiKeyRecord({
  hashedToken,
  fetcher = fetch,
}: FetchApiKeyOptions): Promise<ApiKeyRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  const response = await fetcher(
    `${url}/rest/v1/api_keys?select=*&hashed_token=eq.${hashedToken}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch API key record (${response.status})`);
  }

  const data = (await response.json()) as ApiKeyRow[];
  if (!data.length) {
    return null;
  }

  return data[0];
}

function buildErrorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function handleExternalApiAuth(
  request: NextRequest,
  fetcher: Fetcher = fetch
) {
  const token = request.headers.get('x-api-key');
  if (!token) {
    return buildErrorResponse(401, 'Missing X-Api-Key header');
  }

  let hashedToken: string;
  try {
    hashedToken = await hashApiKey(token);
  } catch (error) {
    console.error('Failed to hash API key', error);
    return buildErrorResponse(500, 'Unable to verify API key');
  }

  let record: ApiKeyRow | null = null;

  try {
    record = await fetchApiKeyRecord({ hashedToken, fetcher });
  } catch (error) {
    console.error('Failed to look up API key', error);
    return buildErrorResponse(500, 'Unable to verify API key');
  }

  if (!record) {
    return buildErrorResponse(401, 'Invalid API key');
  }

  const status = getApiKeyStatus(record);
  if (status !== 'active') {
    return buildErrorResponse(401, `API key ${status}`);
  }

  const rateResult = checkRateLimit(`external:${record.id}`);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateResult.reset - Date.now()) / 1000).toString(),
          'X-Rate-Limit-Limit': rateResult.limit.toString(),
          'X-Rate-Limit-Remaining': '0',
          'X-Rate-Limit-Reset': rateResult.reset.toString(),
        },
      }
    );
  }

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set('x-api-key-id', record.id);
  forwardedHeaders.set('x-rate-limit-limit', rateResult.limit.toString());
  forwardedHeaders.set('x-rate-limit-remaining', rateResult.remaining.toString());
  forwardedHeaders.set('x-rate-limit-reset', rateResult.reset.toString());

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });
  response.headers.set('X-Rate-Limit-Limit', rateResult.limit.toString());
  response.headers.set('X-Rate-Limit-Remaining', rateResult.remaining.toString());
  response.headers.set('X-Rate-Limit-Reset', rateResult.reset.toString());

  return response;
}
