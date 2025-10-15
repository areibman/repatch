import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { test, expect, request as playwrightRequest } from '@playwright/test';
import {
  ApiKey,
  ApiKeyRepository,
  hashToken,
  validateApiKey,
} from '@/lib/api-keys';
import { MemoryRateLimiter } from '@/lib/rate-limit';

const PORT = 4310;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const sampleKey: ApiKey = {
  id: 'playwright-key',
  name: 'Playwright Test',
  tokenPrefix: 'rk_playwright',
  description: null,
  metadata: {},
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const repository = new TestRepository({ 'playwright-valid': sampleKey });
const limiter = new MemoryRateLimiter(3, 1_000);

const samplePayload = {
  data: [
    {
      id: 'patch-1',
      repoName: 'acme/repatch',
      repoUrl: 'https://github.com/acme/repatch',
      title: 'Weekly Update',
      timePeriod: '1week',
      generatedAt: new Date().toISOString(),
      summary: 'Key updates shipped for partners.',
      highlights: [
        { title: 'Authentication', summary: 'Added API key rotation support.' },
      ],
      changeMetrics: { added: 120, modified: 45, removed: 12 },
    },
  ],
};

let server: ReturnType<typeof createServer> | undefined;

async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url) {
    res.statusCode = 404;
    res.end();
    return;
  }

  if (!req.url.startsWith('/api/external/')) {
    res.statusCode = 404;
    res.end();
    return;
  }

  const apiKeyHeader = req.headers['x-api-key'];
  const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

  if (!apiKey) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing X-Api-Key header' }));
    return;
  }

  const validation = await validateApiKey(apiKey, repository);

  if (!validation.valid) {
    res.statusCode = validation.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: validation.message }));
    return;
  }

  const rate = limiter.take(validation.key.id);

  if (!rate.ok) {
    res.statusCode = 429;
    res.setHeader('Retry-After', rate.retryAfter.toString());
    res.setHeader('X-RateLimit-Limit', limiter.getLimit().toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', Math.ceil(rate.resetAt / 1000).toString());
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
    return;
  }

  res.setHeader('X-RateLimit-Limit', limiter.getLimit().toString());
  res.setHeader('X-RateLimit-Remaining', rate.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(rate.resetAt / 1000).toString());

  if (req.url === '/api/external/patch-notes') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(samplePayload));
    return;
  }

  res.statusCode = 404;
  res.end();
}

test.beforeAll(async () => {
  server = createServer((req, res) => {
    handler(req, res).catch((error) => {
      console.error('Test server error', error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'internal error' }));
    });
  }).listen(PORT);
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => {
    server?.close(() => resolve());
  });
});

test('returns sanitized payload for a valid API key', async () => {
  const context = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const response = await context.get('/api/external/patch-notes', {
    headers: { 'X-Api-Key': 'playwright-valid' },
  });

  expect(response.status()).toBe(200);
  const json = await response.json();
  expect(json.data).toHaveLength(1);
  expect(json.data[0]).toMatchObject({
    id: 'patch-1',
    summary: expect.stringContaining('Key updates'),
  });
});

test('rejects requests with invalid keys', async () => {
  const context = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const response = await context.get('/api/external/patch-notes', {
    headers: { 'X-Api-Key': 'invalid-key' },
  });

  expect(response.status()).toBe(401);
  const json = await response.json();
  expect(json.error).toContain('Invalid');
});

test('enforces the configured rate limit', async () => {
  const context = await playwrightRequest.newContext({ baseURL: BASE_URL });

  for (let i = 0; i < 3; i += 1) {
    const okResponse = await context.get('/api/external/patch-notes', {
      headers: { 'X-Api-Key': 'playwright-valid' },
    });
    expect(okResponse.status()).toBe(200);
  }

  const limited = await context.get('/api/external/patch-notes', {
    headers: { 'X-Api-Key': 'playwright-valid' },
  });

  expect(limited.status()).toBe(429);
  const json = await limited.json();
  expect(json.error).toBe('Rate limit exceeded');
});

class TestRepository implements ApiKeyRepository {
  private readonly store: Record<string, ApiKey>;
  touchedIds: string[] = [];

  constructor(keys: Record<string, ApiKey>) {
    this.store = Object.entries(keys).reduce((acc, [token, key]) => {
      acc[hashToken(token)] = key;
      return acc;
    }, {} as Record<string, ApiKey>);
  }

  async create() {
    throw new Error('not implemented');
  }

  async list() {
    return Object.values(this.store);
  }

  async rotate() {
    throw new Error('not implemented');
  }

  async revoke() {
    throw new Error('not implemented');
  }

  async findByHashedToken(hash: string) {
    return this.store[hash] ?? null;
  }

  async touch(id: string) {
    this.touchedIds.push(id);
  }
}
