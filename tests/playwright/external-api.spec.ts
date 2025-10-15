import { test, expect } from '@playwright/test';

const apiKey = process.env.PLAYWRIGHT_EXTERNAL_API_KEY;

test.describe.configure({ mode: 'serial' });

test.describe('External API', () => {
  test('rejects requests without an API key', async ({ request }) => {
    const response = await request.get('/api/external/patch-notes');
    expect(response.status()).toBe(401);
  });

  test('returns sanitized patch notes when authorized', async ({ request }) => {
    test.skip(!apiKey, 'PLAYWRIGHT_EXTERNAL_API_KEY not configured');

    const response = await request.get('/api/external/patch-notes', {
      headers: {
        'X-Api-Key': apiKey!,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.patchNotes)).toBeTruthy();
    if (body.patchNotes.length > 0) {
      const note = body.patchNotes[0];
      expect(note).toHaveProperty('summary');
      expect(note).not.toHaveProperty('video_data');
    }
  });

  test('surfaces rate-limit headers and 429 responses', async ({ request }) => {
    test.skip(!apiKey, 'PLAYWRIGHT_EXTERNAL_API_KEY not configured');

    const first = await request.get('/api/external/patch-notes', {
      headers: {
        'X-Api-Key': apiKey!,
      },
    });
    expect(first.status()).toBe(200);

    const limitHeader = Number(first.headers()['x-rate-limit-limit'] ?? '0');
    const remainingHeader = Number(first.headers()['x-rate-limit-remaining'] ?? '0');
    expect(limitHeader).toBeGreaterThan(0);
    expect(remainingHeader).toBeGreaterThanOrEqual(0);

    const attempts = limitHeader + 2;
    let hitRateLimit = false;

    for (let i = 0; i < attempts; i += 1) {
      const response = await request.get('/api/external/patch-notes', {
        headers: {
          'X-Api-Key': apiKey!,
        },
      });

      if (response.status() === 429) {
        hitRateLimit = true;
        expect(Number(response.headers()['retry-after'] ?? '0')).toBeGreaterThan(0);
        break;
      }
    }

    expect(hitRateLimit).toBeTruthy();
  });
});
