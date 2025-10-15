# External API Guide

The external API exposes read-only endpoints for sanitized patch notes and AI summaries. All requests must include a valid `X-Api-Key` header issued from the admin dashboard (`/integrations/api-keys`). API keys are hashed at rest and enforced through middleware that validates credentials and rate limits requests per key.

## Authentication

- Header: `X-Api-Key: <your-secret>`
- Keys can be created, rotated, and revoked from the dashboard or via the administrative API (`/api/admin/api-keys`).
- Rate limits default to 60 requests per minute, configurable per key. When the limit is exceeded the API responds with `429 Too Many Requests` and a `Retry-After` header in seconds.

## Endpoints

All endpoints return JSON and require authentication.

### `GET /api/external/patch-notes`

Fetch the most recent patch notes with sanitized fields.

Query parameters:

- `limit` (optional, integer): maximum number of entries to return.

Response shape:

```json
[
  {
    "id": "uuid",
    "title": "string",
    "repo": { "name": "string", "url": "https://..." },
    "summary": "string",
    "generatedAt": "2025-01-01T00:00:00.000Z",
    "timePeriod": "1week",
    "contributors": ["alice"],
    "metrics": { "added": 12, "modified": 8, "removed": 3 },
    "highlights": ["Top change summary", "Another insight"]
  }
]
```

### `GET /api/external/patch-notes/:id`

Fetch a single sanitized patch note by identifier. Returns `404` if the note is missing.

### `GET /api/external/summaries`

Return a lightweight list of patch note summaries that is convenient for changelog feeds or newsletter snippets. Supports the same optional `limit` parameter as the patch note collection endpoint.

Response shape:

```json
[
  {
    "id": "uuid",
    "title": "string",
    "summary": "string",
    "generatedAt": "2025-01-01T00:00:00.000Z",
    "repo": { "name": "string", "url": "https://..." },
    "timePeriod": "1week"
  }
]
```

## Usage Examples

### cURL

```bash
curl \
  -H "X-Api-Key: $REPATCH_API_KEY" \
  "https://your-app.example.com/api/external/patch-notes?limit=5"
```

### JavaScript (fetch)

```ts
const response = await fetch("/api/external/patch-notes", {
  headers: {
    "X-Api-Key": process.env.NEXT_PUBLIC_REPATCH_API_KEY!,
  },
});

if (!response.ok) {
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    throw new Error(`Rate limited. Retry in ${retryAfter} seconds.`);
  }
  throw new Error("Unexpected response");
}

const notes = await response.json();
```

### Handling Rotation

Keys should be rotated periodically. Call `POST /api/admin/api-keys/{id}/rotate` to mint a new secret and update any clients immediately. The previous secret is invalidated as soon as the rotation completes.

## Error Handling

| Status | Meaning | Notes |
| ------ | ------- | ----- |
| 401 | Missing, invalid, or revoked API key | Ensure the `X-Api-Key` header is present and not revoked. |
| 429 | Rate limit exceeded | Respect the `Retry-After` header before retrying. |
| 500 | Internal error | Retry with backoff; contact support if persistent. |

## Testing

Integration tests (`__tests__/external-api.test.ts`) cover successful and failed authentication scenarios, and Playwright API tests (`playwright/tests/external-api.spec.ts`) assert rate limit behaviour for external consumers.
